import { airportByCode } from './airports.ts';
import { haversineKm } from './geo.ts';
import { YUL } from './constants.ts';
import type { LiveAircraft } from './types.ts';

export type RouteProgress = {
  percent?: number;
  remainingKm?: number;
  remainingMs?: number;
  remainingSource: 'fr24' | 'calculated';
};

export function remainingMs(aircraft: LiveAircraft, now = Date.now()) {
  if (!aircraft.eta) return undefined;
  const eta = Date.parse(aircraft.eta);
  if (!Number.isFinite(eta)) return undefined;
  return eta - now;
}

export function routeProgress(aircraft: LiveAircraft, now = Date.now()): RouteProgress {
  const remainingKm = aircraft.distanceFromYulKm;
  const etaMs = remainingMs(aircraft, now);
  const speedKmh =
    aircraft.groundSpeedKt && aircraft.groundSpeedKt > 40
      ? aircraft.groundSpeedKt * 1.852
      : undefined;
  const calculatedMs =
    remainingKm !== undefined && speedKmh
      ? (remainingKm / speedKmh) * 3_600_000
      : undefined;
  const remainingMsValue =
    etaMs !== undefined && etaMs > 0 ? etaMs : calculatedMs;
  const remainingSource: 'fr24' | 'calculated' =
    etaMs !== undefined && etaMs > 0 ? 'fr24' : 'calculated';

  const origin = airportByCode(aircraft.origin);
  const destination = airportByCode(aircraft.destination);
  let percent: number | undefined;
  if (aircraft.direction === 'INBOUND' && origin && remainingKm !== undefined) {
    const total = haversineKm(origin.latitude, origin.longitude, YUL.latitude, YUL.longitude);
    if (total > 5) percent = clampPercent(((total - remainingKm) / total) * 100);
  } else if (aircraft.direction === 'OUTBOUND' && destination && remainingKm !== undefined) {
    const total = haversineKm(YUL.latitude, YUL.longitude, destination.latitude, destination.longitude);
    if (total > 5) percent = clampPercent((remainingKm / total) * 100);
  }

  return {
    percent,
    remainingKm,
    remainingMs: remainingMsValue,
    remainingSource,
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(99, Math.max(1, Math.round(value)));
}
