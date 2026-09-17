import { ARRIVAL_ALERT_WINDOW_MS, YUL } from './constants.ts';
import { flightLabel, formatClockShort, formatDuration, routeLabel } from './format.ts';
import { scheduledArrivalMs } from './schedule-sta.ts';
import { isTaxiing } from './status.ts';
import type { LiveAircraft } from './types.ts';

export type ArrivalVariance = 'early' | 'late' | 'on-time';

export type ArrivalAlert = {
  id: string;
  flightLabel: string;
  route?: string;
  remainingMs: number;
  etaMs: number;
  staMs: number;
  varianceMs: number;
  kind: ArrivalVariance;
};

const ON_TIME_MS = 60_000;

export function arrivalVariance(varianceMs: number): ArrivalVariance {
  if (varianceMs >= ON_TIME_MS) return 'late';
  if (varianceMs <= -ON_TIME_MS) return 'early';
  return 'on-time';
}

function staMsFor(aircraft: LiveAircraft, etaMs: number) {
  const fromCsv = scheduledArrivalMs(aircraft.flightNumber || aircraft.callsign, etaMs);
  if (fromCsv !== undefined) return fromCsv;
  if (aircraft.sta) {
    const parsed = Date.parse(aircraft.sta);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * ETA vs STA timing for an inbound flight, when both exist.
 * Unlike arrivalAlert, this has no freshness/window gates — it is a display helper.
 */
export function arrivalTiming(aircraft: LiveAircraft) {
  if (aircraft.direction !== 'INBOUND' || !aircraft.eta) return null;
  const etaMs = Date.parse(aircraft.eta);
  if (!Number.isFinite(etaMs)) return null;
  const staMs = staMsFor(aircraft, etaMs);
  if (staMs === undefined || !Number.isFinite(staMs)) return null;
  const varianceMs = etaMs - staMs;
  return { etaMs, staMs, varianceMs, kind: arrivalVariance(varianceMs) };
}

export function arrivalAlert(aircraft: LiveAircraft, now = Date.now()): ArrivalAlert | null {
  if (aircraft.direction !== 'INBOUND') return null;
  if (isTaxiing(aircraft)) return null;
  const timing = arrivalTiming(aircraft);
  if (!timing) return null;
  const { etaMs, staMs, varianceMs, kind } = timing;
  const remainingMs = etaMs - now;
  if (Math.abs(remainingMs) > ARRIVAL_ALERT_WINDOW_MS && Math.abs(staMs - now) > ARRIVAL_ALERT_WINDOW_MS) {
    return null;
  }
  if (kind === 'on-time') return null;
  return {
    id: aircraft.id,
    flightLabel: flightLabel(aircraft),
    route: routeLabel(aircraft.origin, aircraft.destination),
    remainingMs,
    etaMs,
    staMs,
    varianceMs,
    kind,
  };
}

export function arrivalAlerts(aircraft: LiveAircraft[], now = Date.now()) {
  return aircraft
    .map((item) => arrivalAlert(item, now))
    .filter((item): item is ArrivalAlert => Boolean(item));
}

export function arrivalAlertHeadline(alert: ArrivalAlert) {
  return `${alert.flightLabel} ${alert.kind}`;
}

export function arrivalAlertDetail(alert: ArrivalAlert) {
  const duration = formatDuration(Math.abs(alert.varianceMs));
  return [alert.route, duration].filter(Boolean).join(' · ');
}

export function arrivalAlertClocks(alert: ArrivalAlert) {
  const eta = formatClockShort(alert.etaMs, YUL.timeZone);
  const sta = formatClockShort(alert.staMs, YUL.timeZone);
  if (!eta || !sta) return undefined;
  return `ETA ${eta} · STA ${sta}`;
}
