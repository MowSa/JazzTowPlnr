declare const Netlify: { env: { get(name: string): string | undefined } };

type EdgeContext = {
  next(): Promise<Response>;
};

const COOKIE = 'jazztow_access';
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

function cookieValue(request: Request, name: string) {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

async function equalSecret(left: string, right: string, secret: string) {
  const [leftHash, rightHash] = await Promise.all([hmac(left, secret), hmac(right, secret)]);
  if (leftHash.length !== rightHash.length) return false;
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) difference |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index);
  return difference === 0;
}

async function hasValidSession(request: Request, secret: string) {
  const value = cookieValue(request, COOKIE);
  if (!value) return false;
  const [timestamp, signature] = value.split('.');
  const issuedAt = Number(timestamp);
  if (!Number.isInteger(issuedAt) || !signature || Date.now() / 1000 - issuedAt > SESSION_LIFETIME_SECONDS || issuedAt > Date.now() / 1000 + 60) return false;
  return equalSecret(signature, await hmac(timestamp, secret), secret);
}

function loginPage(error = false) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JazzTow access</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f8f7;color:#17262d;font:16px system-ui,sans-serif}main{width:min(360px,calc(100% - 48px));background:#fff;border:1px solid #d9e3e1;border-radius:12px;padding:32px;box-shadow:0 12px 35px #17303c12}h1{margin:0 0 8px;font-size:24px}p{color:#52666d;line-height:1.5}label{display:block;margin-top:22px;font-weight:600}input{box-sizing:border-box;width:100%;height:44px;margin-top:8px;padding:0 12px;border:1px solid #aebfbc;border-radius:6px;font:inherit}button{width:100%;height:44px;margin-top:18px;border:0;border-radius:6px;background:#007566;color:#fff;font:600 16px system-ui,sans-serif;cursor:pointer}.error{color:#a0322f}</style></head><body><main><h1>JazzTow</h1><p>Enter the access password to continue.</p>${error ? '<p class="error" role="alert">Incorrect password.</p>' : ''}<form method="post" action="/__jazz_auth"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button type="submit">Continue</button></form></main></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async function passwordWall(request: Request, context: EdgeContext) {
  const password = Netlify.env.get('JAZZTOW_PASSWORD');
  const sessionSecret = Netlify.env.get('JAZZTOW_SESSION_SECRET');
  if (!password || !sessionSecret) return new Response('Access control is not configured.', { status: 503, headers: { 'cache-control': 'no-store' } });

  const url = new URL(request.url);
  if (url.pathname === '/__jazz_auth' && request.method === 'POST') {
    const submitted = String((await request.formData()).get('password') || '');
    if (!(await equalSecret(submitted, password, sessionSecret))) return loginPage(true);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await hmac(timestamp, sessionSecret);
    return new Response(null, { status: 303, headers: { location: '/', 'set-cookie': `${COOKIE}=${timestamp}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_LIFETIME_SECONDS}`, 'cache-control': 'no-store' } });
  }

  if (await hasValidSession(request, sessionSecret)) return context.next();
  return loginPage();
}
