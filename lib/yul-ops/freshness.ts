import { DEFAULT_STALE_MS } from './constants.ts';
import type { LiveAircraft, LiveFlightsResponse } from './types.ts';

/** Visualization is not a flight model: never project beyond one default poll. */
export const MAX_EXTRAPOLATION_MS = 120_000;
/** Allow minor clock skew, but never use a far-future timestamp as fresh data. */
export const MAX_CLOCK_SKEW_MS = 30_000;
export type FeedFreshnessContext = Pick<LiveFlightsResponse, 'status' | 'fetchedAt' | 'staleAfterMs'>;

export function sourceTimestamp(value: unknown, now = Date.now()): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now + MAX_CLOCK_SKEW_MS
    ? value
    : null;
}

export function timestampAgeMs(value: unknown, now = Date.now()) {
  const timestamp = sourceTimestamp(value, now);
  return timestamp === null ? Infinity : Math.max(0, now - timestamp);
}

export function freshnessWindowMs(value: number = DEFAULT_STALE_MS) {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_STALE_MS;
}

export function isFeedStale(feed: FeedFreshnessContext, now = Date.now()) {
  return feed.status !== 'ok' || timestampAgeMs(feed.fetchedAt, now) >= freshnessWindowMs(feed.staleAfterMs);
}

export function isAircraftStale(aircraft: Pick<LiveAircraft, 'lastUpdated'>, staleAfterMs = DEFAULT_STALE_MS, now = Date.now()) {
  return timestampAgeMs(aircraft.lastUpdated, now) >= freshnessWindowMs(staleAfterMs);
}

/** Arrival notices must pass both the response clock and the individual source clock. */
export function freshArrivalAircraft(feed: LiveFlightsResponse, now = Date.now()) {
  if (isFeedStale(feed, now)) return [];
  return feed.aircraft.filter((aircraft) => !isAircraftStale(aircraft, feed.staleAfterMs, now));
}
