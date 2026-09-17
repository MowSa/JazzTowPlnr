import { ARRIVING_WINDOW_MS, TAXIING_ALTITUDE_FT } from './constants.ts';
import { routeProgress } from './progress.ts';
import type { LiveAircraft } from './types.ts';

export type FlightPhase = 'arriving' | 'taxiing' | 'airborne';

export function isTaxiing(aircraft: Pick<LiveAircraft, 'altitudeFt'>) {
  const altitude = aircraft.altitudeFt;
  if (altitude === undefined || !Number.isFinite(altitude)) return true;
  return altitude < TAXIING_ALTITUDE_FT;
}

export function flightPhase(aircraft: LiveAircraft, now = Date.now()): FlightPhase {
  if (isTaxiing(aircraft)) return 'taxiing';
  if (aircraft.direction === 'INBOUND') {
    const remaining = routeProgress(aircraft, now).remainingMs;
    if (remaining !== undefined && remaining >= 0 && remaining <= ARRIVING_WINDOW_MS) {
      return 'arriving';
    }
  }
  return 'airborne';
}

export function flightPhaseLabel(phase: FlightPhase) {
  if (phase === 'arriving') return 'Arriving';
  if (phase === 'taxiing') return 'Taxiing';
  return 'Airborne';
}
