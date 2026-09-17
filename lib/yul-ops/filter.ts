import { JAZZ, YUL_AIRPORT_CODES } from './constants.ts';
import { distanceFromYulKm } from './geo.ts';
import type { Fr24LivePosition, LiveAircraft } from './types.ts';

function text(value: string | number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const next = String(value).trim();
  return next ? next : undefined;
}

function code(value: string | null | undefined) {
  const next = text(value);
  return next ? next.toUpperCase() : undefined;
}

function isYul(iata?: string, icao?: string) {
  return (
    (iata ? YUL_AIRPORT_CODES.has(iata) : false) ||
    (icao ? YUL_AIRPORT_CODES.has(icao) : false)
  );
}

export function isJazzOperator(position: Fr24LivePosition) {
  const operating = code(position.operating_as);
  if (operating) return operating === JAZZ.icao;
  const callsign = code(position.callsign);
  return Boolean(callsign?.startsWith(JAZZ.callsignPrefix));
}

export function toLiveAircraft(position: Fr24LivePosition): LiveAircraft | null {
  const latitude = Number(position.lat);
  const longitude = Number(position.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!isJazzOperator(position)) return null;

  const origin = code(position.orig_iata);
  const originIcao = code(position.orig_icao);
  const destination = code(position.dest_iata);
  const destinationIcao = code(position.dest_icao);
  const inbound = isYul(destination, destinationIcao);
  const outbound = isYul(origin, originIcao);
  if (!inbound && !outbound) return null;

  const altitude = Number(position.alt);
  const speed = Number(position.gspeed);
  const vertical = Number(position.vspeed);
  const heading = Number(position.track);
  const updated = position.timestamp ? Date.parse(position.timestamp) : Date.now();

  return {
    id: text(position.fr24_id) || `${code(position.callsign) || 'JZA'}-${latitude.toFixed(3)}`,
    flightNumber: code(position.flight),
    callsign: code(position.callsign),
    registration: code(position.reg),
    aircraftType: code(position.type),
    operator: `${JAZZ.marketedAs} / ${JAZZ.name}`,
    operatorIcao: JAZZ.icao,
    paintedAs: code(position.painted_as),
    origin,
    originIcao,
    destination,
    destinationIcao,
    eta: text(position.eta),
    sta: text(position.sta),
    latitude,
    longitude,
    altitudeFt: Number.isFinite(altitude) ? altitude : undefined,
    groundSpeedKt: Number.isFinite(speed) ? speed : undefined,
    verticalSpeedFpm: Number.isFinite(vertical) ? vertical : undefined,
    headingDeg: Number.isFinite(heading) ? (heading + 360) % 360 : undefined,
    squawk: text(position.squawk),
    transponderHex: code(position.hex),
    positionSource: text(position.source),
    distanceFromYulKm: distanceFromYulKm(latitude, longitude),
    direction: inbound ? 'INBOUND' : 'OUTBOUND',
    lastUpdated: Number.isFinite(updated) ? updated : Date.now(),
  };
}

export function filterJazzYul(positions: Fr24LivePosition[]) {
  const seen = new Set<string>();
  const aircraft: LiveAircraft[] = [];
  for (const position of positions) {
    const live = toLiveAircraft(position);
    if (!live || seen.has(live.id)) continue;
    seen.add(live.id);
    aircraft.push(live);
  }
  return aircraft;
}

export function matchesFilters(
  aircraft: LiveAircraft,
  filters: {
    direction: 'ALL' | 'INBOUND' | 'OUTBOUND';
    aircraftType: string;
    airport: string;
    registration: string;
    flightNumber: string;
    query: string;
  },
) {
  if (filters.direction !== 'ALL' && aircraft.direction !== filters.direction) return false;
  const type = filters.aircraftType.trim().toUpperCase();
  if (type && !(aircraft.aircraftType || '').includes(type)) return false;
  const airport = filters.airport.trim().toUpperCase();
  if (
    airport &&
    aircraft.origin !== airport &&
    aircraft.originIcao !== airport &&
    aircraft.destination !== airport &&
    aircraft.destinationIcao !== airport
  ) {
    return false;
  }
  const registration = filters.registration.trim().toUpperCase();
  if (registration && !(aircraft.registration || '').includes(registration)) return false;
  const flight = filters.flightNumber.trim().toUpperCase();
  if (
    flight &&
    !(aircraft.flightNumber || '').includes(flight) &&
    !(aircraft.callsign || '').includes(flight)
  ) {
    return false;
  }
  const query = filters.query.trim().toUpperCase();
  if (!query) return true;
  const haystack = [
    aircraft.flightNumber,
    aircraft.callsign,
    aircraft.registration,
    aircraft.origin,
    aircraft.destination,
    aircraft.originIcao,
    aircraft.destinationIcao,
    aircraft.aircraftType,
  ]
    .filter(Boolean)
    .join(' ');
  return haystack.includes(query);
}

export function sortInbound(aircraft: LiveAircraft[]) {
  return [...aircraft].sort((a, b) => {
    const aEta = a.eta ? Date.parse(a.eta) : NaN;
    const bEta = b.eta ? Date.parse(b.eta) : NaN;
    if (Number.isFinite(aEta) && Number.isFinite(bEta) && aEta !== bEta) return aEta - bEta;
    if (Number.isFinite(aEta) !== Number.isFinite(bEta)) return Number.isFinite(aEta) ? -1 : 1;
    return (a.distanceFromYulKm ?? 1e9) - (b.distanceFromYulKm ?? 1e9);
  });
}

export function sortOutbound(aircraft: LiveAircraft[]) {
  return [...aircraft].sort((a, b) => {
    const aAlt = a.altitudeFt ?? -1;
    const bAlt = b.altitudeFt ?? -1;
    if (aAlt !== bAlt) return aAlt - bAlt;
    return (a.distanceFromYulKm ?? 0) - (b.distanceFromYulKm ?? 0);
  });
}

export function sortLiveFlights(aircraft: LiveAircraft[]) {
  return [...sortInbound(aircraft.filter((item) => item.direction === 'INBOUND')), ...sortOutbound(aircraft.filter((item) => item.direction === 'OUTBOUND'))];
}

export type FlightSortKey = 'auto' | 'distance' | 'altitude';

export function sortFlights(aircraft: LiveAircraft[], key: FlightSortKey = 'auto') {
  if (key === 'distance') {
    return [...aircraft].sort(
      (a, b) => (a.distanceFromYulKm ?? 1e9) - (b.distanceFromYulKm ?? 1e9),
    );
  }
  if (key === 'altitude') {
    return [...aircraft].sort((a, b) => (b.altitudeFt ?? -1) - (a.altitudeFt ?? -1));
  }
  return sortLiveFlights(aircraft);
}
