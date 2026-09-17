import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.QA_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('QA_PORT must be a valid port.');
const url = process.env.QA_URL || `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  DEMO_MODE: 'true',
  NEXT_PUBLIC_DEMO_MODE: 'true',
  FR24_API_KEY: '',
  QA_URL: url,
  QA_SMOKE: process.argv.includes('--smoke') ? 'true' : 'false',
};
let server;
let qa;
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 5000);
  try { await exited; } finally { clearTimeout(force); }
}
async function shutdown(signal) {
  await Promise.all([stop(qa), stop(server)]);
  process.exit(signal === 'SIGINT' ? 130 : 143);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void shutdown(signal));

try {
  if (!process.env.QA_URL) {
    // Never silently attach to a developer's existing (possibly live-mode) server.
    const probe = createServer();
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(port, '127.0.0.1', resolve);
    });
    await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
    server = spawn(process.execPath, [
      fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
      '--host', '127.0.0.1', '--port', String(port), '--strictPort',
    ], { cwd: root, env, stdio: 'inherit' });
    let startupError;
    server.once('error', (error) => { startupError = error; });
    const deadline = Date.now() + 120_000;
    for (;;) {
      if (startupError) throw startupError;
      if (server.exitCode !== null || server.signalCode !== null) throw new Error('QA server exited before becoming ready.');
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        await response.arrayBuffer();
        if (response.ok) break;
      } catch { /* Server may still be compiling. */ }
      if (Date.now() >= deadline) throw new Error(`QA server did not become ready at ${url} within 120 seconds.`);
      await delay(300);
    }
  } else {
    console.log(`Using explicit QA_URL=${url}; its server must already have DEMO_MODE=true.`);
  }
  qa = spawn(process.execPath, [fileURLToPath(new URL('./qa-ui.mjs', import.meta.url))], {
    cwd: root, env, stdio: 'inherit',
  });
  const [code, signal] = await once(qa, 'exit');
  if (signal) throw new Error(`Browser QA terminated with ${signal}.`);
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stop(qa);
  await stop(server);
}
