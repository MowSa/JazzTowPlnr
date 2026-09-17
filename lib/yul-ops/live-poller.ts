import { DEFAULT_REFRESH_MS, DEFAULT_STALE_MS } from './constants.ts';
import type { LiveFlightsResponse } from './types.ts';

type PollResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<LiveFlightsResponse>;
};

type PollerDependencies = {
  fetch: (signal: AbortSignal) => Promise<PollResponse>;
  now: () => number;
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (timer: unknown) => void;
};

/** One request/timer per subscribed store, independent of React and browser globals. */
export function createLiveFlightsPoller(deps: PollerDependencies) {
  let snapshot: LiveFlightsResponse | null = null;
  let lastGood: LiveFlightsResponse | null = null;
  let refreshIntervalMs = DEFAULT_REFRESH_MS;
  let failures = 0;
  let generation = 0;
  let timer: unknown = null;
  let controller: AbortController | null = null;
  let nextPollAt = 0;
  const listeners = new Set<() => void>();

  const isActive = (epoch: number) => generation === epoch && listeners.size > 0;

  function publish(value: LiveFlightsResponse) {
    snapshot = value;
    for (const listener of listeners) listener();
  }

  function schedule(epoch: number, delayMs: number) {
    if (!isActive(epoch)) return;
    nextPollAt = deps.now() + delayMs;
    timer = deps.setTimeout(() => {
      if (!isActive(epoch)) return;
      timer = null;
      void pull(epoch);
    }, delayMs);
  }

  function failure(message: string, payload?: LiveFlightsResponse) {
    failures = Math.min(failures + 1, 3);
    publish(lastGood
      ? { ...lastGood, status: 'delayed', error: message }
      : {
          mode: payload?.mode ?? 'live',
          status: 'error',
          fetchedAt: payload?.fetchedAt ?? deps.now(),
          refreshIntervalMs,
          staleAfterMs: payload?.staleAfterMs ?? DEFAULT_STALE_MS,
          aircraft: [],
          error: message,
        });
  }

  async function pull(epoch: number) {
    if (!isActive(epoch)) return;
    const request = new AbortController();
    controller = request;
    try {
      const response = await deps.fetch(request.signal);
      if (!isActive(epoch)) return;
      const payload = await response.json();
      if (!isActive(epoch)) return;
      if (Number.isFinite(payload.refreshIntervalMs) && payload.refreshIntervalMs > 0) {
        refreshIntervalMs = payload.refreshIntervalMs;
      }
      if (!response.ok || payload.status === 'error') {
        failure(payload.error || (response.ok ? 'Live feed reported an error' : `Live feed HTTP ${response.status}`), payload);
      } else {
        failures = 0;
        lastGood = payload;
        publish(payload);
      }
    } catch (error) {
      if (!isActive(epoch)) return;
      failure(error instanceof Error ? error.message : 'Network error');
    } finally {
      // Aborting is best effort: a fetch/json promise can still resolve after teardown.
      if (isActive(epoch)) {
        controller = null;
        // Retry at 1x/2x/4x the last server interval, never an 8-second live fallback.
        schedule(epoch, refreshIntervalMs * 2 ** Math.max(0, failures - 1));
      }
    }
  }

  return {
    getSnapshot: () => snapshot,
    getNextPollAt: () => nextPollAt,
    getServerSnapshot: (): LiveFlightsResponse | null => null,
    subscribe: (listener: () => void) => {
      // Each subscription owns a distinct entry, even if callbacks are identical.
      const notify = () => listener();
      listeners.add(notify);
      if (listeners.size === 1) {
        const epoch = ++generation;
        schedule(epoch, Math.max(0, nextPollAt - deps.now()));
      }
      return () => {
        if (!listeners.delete(notify) || listeners.size > 0) return;
        ++generation;
        if (timer !== null) deps.clearTimeout(timer);
        timer = null;
        controller?.abort();
        controller = null;
      };
    },
  };
}
