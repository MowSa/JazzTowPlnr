import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveFlightsService } from '../lib/yul-ops/live-service.ts';
import { fetchFr24LivePositions, Fr24RequestError, parseFr24LivePositions } from '../lib/yul-ops/fr24.ts';
import type { Fr24LivePosition } from '../lib/yul-ops/types.ts';

const position: Fr24LivePosition = {
  fr24_id: 'one', operating_as: 'JZA', orig_iata: 'YYZ', dest_iata: 'YUL',
  lat: 45, lon: -74, timestamp: '2026-09-16T12:00:00Z',
};

test('malformed FR24 payloads are not successful empty snapshots', () => {
  for (const body of ['null', '{}', '{"data":{}}', '{"data":[null]}', '{"data":[{"lat":91,"lon":0}]}',
    JSON.stringify({data: [{...position, operating_as: 1}]}), 'bad JSON']) {
    assert.throws(() => parseFr24LivePositions(body), /FR24/);
  }
  assert.deepEqual(parseFr24LivePositions('{"data":[]}'), []);
  assert.deepEqual(parseFr24LivePositions(JSON.stringify({data: [position]})), [position]);
});

test('FR24 fetch times out and cancels its request', async () => {
  let signal: AbortSignal | null | undefined;
  const fetchImpl: typeof fetch = (_url, init) => new Promise((_resolve, reject) => {
    signal = init?.signal;
    signal?.addEventListener('abort', () => reject(new Error('aborted')), {once: true});
  });
  await assert.rejects(fetchFr24LivePositions('test', fetchImpl, 5), /timed out/);
  assert.equal(signal?.aborted, true);
});

test('FR24 rate-limit errors preserve Retry-After without exposing provider body', async () => {
  const fetchImpl: typeof fetch = async () => new Response('private provider details', {
    status: 429, headers: {'Retry-After': '300'},
  });
  await assert.rejects(fetchFr24LivePositions('test', fetchImpl), (error: unknown) => {
    assert.ok(error instanceof Fr24RequestError);
    assert.equal(error.retryAfterMs, 300_000);
    assert.doesNotMatch(error.message, /private/);
    return true;
  });
});

test('server shares an in-flight call and caches successful empty snapshots', async () => {
  let now = 0, calls = 0;
  let resolve!: (rows: Fr24LivePosition[]) => void;
  const get = createLiveFlightsService({ now: () => now, demo: () => false, key: () => 'test',
    interval: () => 15_000, fetchPositions: () => { calls++; return new Promise((r) => {resolve = r;}); },
  });
  const first = get(), second = get();
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve([]);
  assert.equal((await first).status, 'ok');
  now = 14_999;
  assert.deepEqual((await get()).aircraft, []);
  assert.equal(calls, 1);
});

test('failure cooldown retains original freshness, backs off and recovers', async () => {
  let now = 1000, calls = 0, fail = false;
  const get = createLiveFlightsService({ now: () => now, demo: () => false, key: () => 'test',
    interval: () => 15_000, fetchPositions: async () => {calls++; if (fail) throw new Error('offline'); return [position];},
  });
  const good = await get();
  fail = true;
  now += 15_000;
  const delayed = await get();
  assert.equal(delayed.status, 'delayed');
  assert.equal(delayed.fetchedAt, good.fetchedAt);
  assert.deepEqual(delayed.aircraft, good.aircraft);
  await get();
  assert.equal(calls, 2);
  now += 15_000;
  assert.equal((await get()).refreshIntervalMs, 30_000);
  fail = false;
  now += 30_000;
  assert.equal((await get()).status, 'ok');
  assert.equal((await get()).refreshIntervalMs, 15_000);
});

test('cold-start failures are cached and Retry-After is respected', async () => {
  let now = 0, calls = 0;
  const get = createLiveFlightsService({ now: () => now, demo: () => false, key: () => 'test',
    interval: () => 15_000, fetchPositions: async () => {calls++; throw new Fr24RequestError(429, 300_000);},
  });
  assert.equal((await get()).status, 'error');
  assert.equal((await get()).refreshIntervalMs, 300_000);
  now = 299_999;
  await get();
  assert.equal(calls, 1);
  now++;
  await get();
  assert.equal(calls, 2);
});

test('demo never calls FR24', async () => {
  const get = createLiveFlightsService({demo: () => true, fetchPositions: async () => {throw new Error('must not call');}});
  assert.equal((await get()).mode, 'demo');
});
