import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveFlightsPoller } from '../lib/yul-ops/live-poller.ts';
import type { LiveFlightsResponse } from '../lib/yul-ops/types.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function feed(overrides: Partial<LiveFlightsResponse> = {}): LiveFlightsResponse {
  return {
    mode: 'live', status: 'ok', fetchedAt: 1000,
    refreshIntervalMs: 120_000, staleAfterMs: 900_000,
    aircraft: [{ id: 'one', latitude: 45, longitude: -73, direction: 'INBOUND', lastUpdated: 1000 }],
    ...overrides,
  };
}

function response(payload: LiveFlightsResponse, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

type Response = ReturnType<typeof response>;

function harness() {
  let now = 1000;
  let id = 0;
  const timers = new Map<number, { callback: () => void; at: number }>();
  const requests: Array<ReturnType<typeof deferred<Response>> & { signal: AbortSignal }> = [];
  const store = createLiveFlightsPoller({
    fetch(signal) {
      const request = { ...deferred<Response>(), signal };
      requests.push(request);
      return request.promise;
    },
    now: () => now,
    setTimeout(callback, delayMs) {
      timers.set(++id, { callback, at: now + delayMs });
      return id;
    },
    clearTimeout(timer) { timers.delete(timer as number); },
  });
  function runNext() {
    assert.equal(timers.size, 1, 'exactly one scheduled poll');
    const [key, timer] = [...timers.entries()][0];
    timers.delete(key);
    now = timer.at;
    timer.callback();
  }
  function delay() {
    assert.equal(timers.size, 1);
    return [...timers.values()][0].at - now;
  }
  return { store, requests, timers, runNext, delay };
}

async function settle() {
  // Flush fetch, response JSON, and finally continuations without wall-clock sleeps.
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

void test('two consumers share one request, snapshot and timer until the final unsubscribe', async () => {
  const h = harness();
  const snapshots: Array<LiveFlightsResponse | null> = [];
  let secondUpdates = 0;
  assert.equal(h.store.getSnapshot(), null);
  assert.equal(h.store.getServerSnapshot(), null);
  assert.equal(h.timers.size, 0);
  const first = h.store.subscribe(() => snapshots.push(h.store.getSnapshot()));
  const second = h.store.subscribe(() => { secondUpdates++; });
  h.runNext();
  assert.equal(h.requests.length, 1);
  assert.equal(h.timers.size, 0, 'no polling while a request is outstanding');
  const payload = feed();
  h.requests[0].resolve(response(payload));
  await settle();
  assert.equal(snapshots[0], payload);
  assert.equal(h.store.getSnapshot(), payload);
  assert.equal(secondUpdates, 1);
  assert.equal(h.store.getServerSnapshot(), null, 'SSR never exposes a client snapshot');
  assert.equal(h.delay(), 120_000);
  assert.equal(h.store.getNextPollAt(), 1000 + 120_000);
  first();
  first();
  assert.equal(h.timers.size, 1, 'idempotent cleanup must not detach the other consumer');
  h.runNext();
  assert.equal(h.requests.length, 2);
  second();
  assert.equal(h.requests[1].signal.aborted, true);
  assert.equal(h.timers.size, 0);
});

void test('late fetch resolution after final unsubscribe cannot publish or schedule', async () => {
  const h = harness();
  let updates = 0;
  const off = h.store.subscribe(() => { updates++; });
  h.runNext();
  off();
  assert.equal(h.requests[0].signal.aborted, true);
  h.requests[0].resolve(response(feed()));
  await settle();
  assert.equal(updates, 0);
  assert.equal(h.store.getSnapshot(), null);
  assert.equal(h.timers.size, 0);
});

void test('late JSON from a disposed generation cannot replace a resubscribed feed or timer', async () => {
  const h = harness();
  const json = deferred<LiveFlightsResponse>();
  const oldOff = h.store.subscribe(() => {});
  h.runNext();
  h.requests[0].resolve({ ok: true, status: 200, json: () => json.promise });
  await settle();
  oldOff();
  const off = h.store.subscribe(() => {});
  h.runNext();
  const current = feed({ fetchedAt: 2000 });
  h.requests[1].resolve(response(current));
  await settle();
  json.resolve(feed({ refreshIntervalMs: 8000 }));
  await settle();
  assert.equal(h.store.getSnapshot(), current);
  assert.equal(h.delay(), 120_000);
  off();
  assert.equal(h.timers.size, 0);
});

void test('late rejection after unsubscribe cannot publish an error or restart polling', async () => {
  const h = harness();
  const off = h.store.subscribe(() => {});
  h.runNext();
  off();
  h.requests[0].reject(new Error('aborted too late'));
  await settle();
  assert.equal(h.store.getSnapshot(), null);
  assert.equal(h.timers.size, 0);
});

void test('network failures default to live 120-second polling and bounded backoff', async () => {
  const h = harness();
  const off = h.store.subscribe(() => {});
  for (const expected of [120_000, 240_000, 480_000, 480_000, 480_000]) {
    h.runNext();
    h.requests.at(-1)!.reject(new Error('offline'));
    await settle();
    assert.equal(h.delay(), expected);
  }
  assert.equal(h.store.getSnapshot()?.mode, 'live');
  assert.equal(h.store.getSnapshot()?.status, 'error');
  assert.equal(h.store.getSnapshot()?.refreshIntervalMs, 120_000);
  off();
});

void test('network, HTTP and HTTP-200 error payloads preserve last good data and timestamp', async () => {
  const h = harness();
  const off = h.store.subscribe(() => {});
  const good = feed({ refreshIntervalMs: 180_000 });
  h.runNext();
  h.requests[0].resolve(response(good));
  await settle();
  assert.equal(h.delay(), 180_000);
  for (const [index, status] of [0, 503, 200].entries()) {
    h.runNext();
    if (status === 0) h.requests.at(-1)!.reject(new Error('offline'));
    else h.requests.at(-1)!.resolve(response(feed({
      status: 'error', aircraft: [], fetchedAt: 9999, error: 'upstream failed',
      refreshIntervalMs: 180_000,
    }), status));
    await settle();
    const snapshot = h.store.getSnapshot();
    assert.equal(snapshot?.aircraft, good.aircraft);
    assert.equal(snapshot?.fetchedAt, good.fetchedAt);
    assert.equal(snapshot?.status, 'delayed');
    assert.ok(snapshot?.error);
    assert.equal(h.delay(), 180_000 * 2 ** index);
  }
  h.runNext();
  const recovered = feed({ fetchedAt: 8888, aircraft: [], refreshIntervalMs: 240_000 });
  h.requests.at(-1)!.resolve(response(recovered));
  await settle();
  assert.equal(h.store.getSnapshot(), recovered, 'a successful empty feed is authoritative');
  assert.equal(h.delay(), 240_000, 'success resets retry backoff');
  off();
});

void test('an empty last-good feed remains last-good when a payload reports an error', async () => {
  const h = harness();
  const off = h.store.subscribe(() => {});
  const good = feed({ aircraft: [] });
  h.runNext();
  h.requests[0].resolve(response(good));
  await settle();
  h.runNext();
  h.requests[1].resolve(response(feed({ status: 'error', error: 'failure' })));
  await settle();
  assert.equal(h.store.getSnapshot()?.aircraft, good.aircraft);
  assert.equal(h.store.getSnapshot()?.status, 'delayed');
  off();
});

void test('demo cadence is honored and a remount retains the scheduled refresh deadline', async () => {
  const h = harness();
  const off = h.store.subscribe(() => {});
  h.runNext();
  h.requests[0].resolve(response(feed({ mode: 'demo', refreshIntervalMs: 8000 })));
  await settle();
  assert.equal(h.delay(), 8000);
  assert.equal(h.store.getNextPollAt(), 1000 + 8000);
  off();
  assert.equal(h.timers.size, 0);
  const remountOff = h.store.subscribe(() => {});
  assert.equal(h.delay(), 8000);
  assert.equal(h.requests.length, 1, 'remount does not eagerly issue another request');
  remountOff();
});
