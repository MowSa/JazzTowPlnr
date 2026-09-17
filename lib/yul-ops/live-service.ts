import { buildDemoAircraft } from './demo.ts';
import {
  cesiumIonToken,
  fr24ApiKey,
  isDemoMode,
  refreshIntervalMs,
  staleAfterMs,
} from './env.ts';
import { MIN_REFRESH_MS } from './constants.ts';
import { filterJazzYul } from './filter.ts';
import { fetchFr24LivePositions, Fr24RequestError } from './fr24.ts';
import type { Fr24LivePosition, LiveFlightsResponse } from './types.ts';

type ServiceOptions = {
  now: () => number;
  demo: () => boolean;
  key: () => string;
  interval: (demo: boolean) => number;
  stale: () => number;
  fetchPositions: (key: string) => Promise<Fr24LivePosition[]>;
};

/** Cache and single-flight coordination are per server instance, not deployment-wide. */
export function createLiveFlightsService(overrides: Partial<ServiceOptions> = {}) {
  const options: ServiceOptions = {
    now: Date.now,
    demo: isDemoMode,
    key: fr24ApiKey,
    interval: refreshIntervalMs,
    stale: staleAfterMs,
    fetchPositions: fetchFr24LivePositions,
    ...overrides,
  };
  let cache: { until: number; value: LiveFlightsResponse } | null = null;
  let lastGood: LiveFlightsResponse | null = null;
  let inFlight: Promise<LiveFlightsResponse> | null = null;
  let failures = 0;

  function response(
    aircraft: LiveFlightsResponse['aircraft'],
    mode: LiveFlightsResponse['mode'],
    status: LiveFlightsResponse['status'],
    extra: Partial<LiveFlightsResponse> = {},
  ): LiveFlightsResponse {
    return {
      aircraft, mode, status,
      fetchedAt: options.now(),
      refreshIntervalMs: options.interval(mode === 'demo'),
      staleAfterMs: options.stale(),
      ...extra,
    };
  }

  async function load(): Promise<LiveFlightsResponse> {
    const interval = Math.max(MIN_REFRESH_MS, options.interval(false));
    try {
      const key = options.key();
      if (!key) throw new Error('FR24_API_KEY is not configured.');
      const aircraft = filterJazzYul(await options.fetchPositions(key));
      const value = response(aircraft, 'live', 'ok', {
        refreshIntervalMs: interval,
        notice: 'Positions are FR24 snapshots. Globe movement between polls is interpolated locally.',
      });
      failures = 0;
      lastGood = value;
      cache = { until: options.now() + interval, value };
      return value;
    } catch (error) {
      failures += 1;
      // Retry only on a later poll: no immediate upstream retry storm or extra credits.
      const backoff = Math.min(interval * 2 ** Math.min(failures - 1, 4), Math.max(interval, 15 * 60_000));
      const cooldown = Math.max(backoff, error instanceof Fr24RequestError ? error.retryAfterMs : 0);
      const message = error instanceof Error ? error.message : 'FR24 request failed';
      const value = lastGood
        ? { ...lastGood, status: 'delayed' as const, error: message,
            refreshIntervalMs: cooldown,
            notice: 'Showing last good FR24 snapshot. Aircraft were not removed.' }
        : response([], 'live', 'error', { error: message, refreshIntervalMs: cooldown });
      cache = { until: options.now() + cooldown, value };
      return value;
    }
  }

  return function getLiveFlights(): Promise<LiveFlightsResponse> {
    if (options.demo()) {
      return Promise.resolve(response(buildDemoAircraft(), 'demo', 'ok', {
        notice: 'Demo mode — mock Jazz/YUL traffic. FR24 is not being queried.',
      }));
    }
    if (cache && options.now() < cache.until) return Promise.resolve(cache.value);
    if (inFlight) return inFlight;
    inFlight = load().finally(() => { inFlight = null; });
    return inFlight;
  };
}

export const getLiveFlights = createLiveFlightsService();

export function getCesiumIonToken() {
  return cesiumIonToken();
}
