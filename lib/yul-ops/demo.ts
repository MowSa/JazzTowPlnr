import { JAZZ, YUL } from './constants.ts';
import { bearingDeg, destinationPoint, distanceFromYulKm } from './geo.ts';
import { toLiveAircraft } from './filter.ts';
import type { Fr24LivePosition, LiveAircraft } from './types.ts';

type DemoSeed = {
  id: string;
  flight: string;
  callsign: string;
  reg: string;
  type: string;
  origin: string;
  originIcao: string;
  dest: string;
  destIcao: string;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  vs: number;
  track: number;
  inbound: boolean;
  cruiseAlt: number;
};

/** Positive minutes mean the demo flight is late (ETA after STA). */
const DEMO_STA_OFFSET_MIN: Record<string, number> = {
  'demo-jza-8901': 12,
  'demo-jza-8764': -8,
  'demo-jza-8718': 22,
  'demo-jza-8822': 7,
  'demo-jza-8641': -5,
};

const SEEDS: DemoSeed[] = [
  {
    id: 'demo-jza-8901',
    flight: 'AC8901',
    callsign: 'JZA8901',
    reg: 'C-GJZD',
    type: 'CRJ9',
    origin: 'YYZ',
    originIcao: 'CYYZ',
    dest: 'YUL',
    destIcao: 'CYUL',
    lat: 44.231,
    lon: -76.486,
    alt: 18400,
    speed: 412,
    vs: -900,
    track: 72,
    inbound: true,
    cruiseAlt: 24000,
  },
  {
    id: 'demo-jza-8764',
    flight: 'AC8764',
    callsign: 'JZA8764',
    reg: 'C-FEJA',
    type: 'E75L',
    origin: 'YQB',
    originIcao: 'CYQB',
    dest: 'YUL',
    destIcao: 'CYUL',
    lat: 46.548,
    lon: -71.741,
    alt: 12200,
    speed: 328,
    vs: -1100,
    track: 246,
    inbound: true,
    cruiseAlt: 18000,
  },
  {
    id: 'demo-jza-8718',
    flight: 'AC8718',
    callsign: 'JZA8718',
    reg: 'C-GZJZ',
    type: 'CRJ9',
    origin: 'YOW',
    originIcao: 'CYOW',
    dest: 'YUL',
    destIcao: 'CYUL',
    lat: 45.412,
    lon: -75.672,
    alt: 8400,
    speed: 286,
    vs: -1200,
    track: 108,
    inbound: true,
    cruiseAlt: 16000,
  },
  {
    id: 'demo-jza-8822',
    flight: 'AC8822',
    callsign: 'JZA8822',
    reg: 'C-FRQY',
    type: 'E75L',
    origin: 'YHZ',
    originIcao: 'CYHZ',
    dest: 'YUL',
    destIcao: 'CYUL',
    lat: 46.21,
    lon: -69.94,
    alt: 26800,
    speed: 438,
    vs: -500,
    track: 252,
    inbound: true,
    cruiseAlt: 34000,
  },
  {
    id: 'demo-jza-8641',
    flight: 'AC8641',
    callsign: 'JZA8641',
    reg: 'C-FEJC',
    type: 'E75L',
    origin: 'BOS',
    originIcao: 'KBOS',
    dest: 'YUL',
    destIcao: 'CYUL',
    lat: 44.79,
    lon: -72.41,
    alt: 15600,
    speed: 364,
    vs: -800,
    track: 338,
    inbound: true,
    cruiseAlt: 24000,
  },
  {
    id: 'demo-jza-8900',
    flight: 'AC8900',
    callsign: 'JZA8900',
    reg: 'C-GJZA',
    type: 'CRJ9',
    origin: 'YUL',
    originIcao: 'CYUL',
    dest: 'YYZ',
    destIcao: 'CYYZ',
    lat: 45.42,
    lon: -74.38,
    alt: 11200,
    speed: 348,
    vs: 1600,
    track: 248,
    inbound: false,
    cruiseAlt: 28000,
  },
  {
    id: 'demo-jza-8711',
    flight: 'AC8711',
    callsign: 'JZA8711',
    reg: 'C-GJZS',
    type: 'CRJ9',
    origin: 'YUL',
    originIcao: 'CYUL',
    dest: 'YOW',
    destIcao: 'CYOW',
    lat: 45.51,
    lon: -74.62,
    alt: 7600,
    speed: 292,
    vs: 1400,
    track: 278,
    inbound: false,
    cruiseAlt: 16000,
  },
  {
    id: 'demo-jza-8765',
    flight: 'AC8765',
    callsign: 'JZA8765',
    reg: 'C-FEJB',
    type: 'E75L',
    origin: 'YUL',
    originIcao: 'CYUL',
    dest: 'YQB',
    destIcao: 'CYQB',
    lat: 45.68,
    lon: -72.91,
    alt: 13400,
    speed: 356,
    vs: 1100,
    track: 58,
    inbound: false,
    cruiseAlt: 21000,
  },
  {
    id: 'demo-jza-8823',
    flight: 'AC8823',
    callsign: 'JZA8823',
    reg: 'C-GJZT',
    type: 'CRJ9',
    origin: 'YUL',
    originIcao: 'CYUL',
    dest: 'YHZ',
    destIcao: 'CYHZ',
    lat: 45.92,
    lon: -71.48,
    alt: 21400,
    speed: 404,
    vs: 700,
    track: 82,
    inbound: false,
    cruiseAlt: 33000,
  },
  {
    id: 'demo-jza-8688',
    flight: 'AC8688',
    callsign: 'JZA8688',
    reg: 'C-GJZW',
    type: 'E75L',
    origin: 'YUL',
    originIcao: 'CYUL',
    dest: 'IAD',
    destIcao: 'KIAD',
    lat: 44.98,
    lon: -74.86,
    alt: 17200,
    speed: 388,
    vs: 900,
    track: 198,
    inbound: false,
    cruiseAlt: 34000,
  },
];

const DEMO_STARTED = Date.now();

function clampAlt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function advanceSeed(seed: DemoSeed, elapsedSec: number): Fr24LivePosition {
  let { lat, lon, alt, track, vs } = seed;
  const step = 8;
  let remaining = elapsedSec;
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    if (seed.inbound) {
      track = bearingDeg(lat, lon, YUL.latitude, YUL.longitude);
      const distance = distanceFromYulKm(lat, lon);
      vs = distance < 80 ? -1400 : distance < 180 ? -800 : -400;
      alt = clampAlt(alt + (vs * dt) / 60, 1800, seed.cruiseAlt);
      if (distance < 8) {
        lat = seed.lat;
        lon = seed.lon;
        alt = seed.alt;
      }
    } else {
      vs = alt < seed.cruiseAlt - 400 ? 1200 : 0;
      alt = clampAlt(alt + (vs * dt) / 60, 1200, seed.cruiseAlt);
      const distance = distanceFromYulKm(lat, lon);
      if (distance > 420) {
        lat = seed.lat;
        lon = seed.lon;
        alt = seed.alt;
      }
    }
    const moved = destinationPoint(lat, lon, track, ((seed.speed * dt) / 3600) * 1852);
    lat = moved.latitude;
    lon = moved.longitude;
    remaining -= dt;
  }
  const eta =
    seed.inbound && seed.speed > 0
      ? new Date(
          Date.now() + (distanceFromYulKm(lat, lon) / (seed.speed * 1.852)) * 3600_000,
        ).toISOString()
      : undefined;
  const etaMs = eta ? Date.parse(eta) : Number.NaN;
  const offsetMin = DEMO_STA_OFFSET_MIN[seed.id];
  const sta =
    Number.isFinite(etaMs) && offsetMin !== undefined
      ? new Date(etaMs - offsetMin * 60_000).toISOString()
      : undefined;
  return {
    fr24_id: seed.id,
    flight: seed.flight,
    callsign: seed.callsign,
    lat,
    lon,
    track,
    alt: Math.round(alt),
    gspeed: seed.speed,
    vspeed: Math.round(vs),
    squawk: '2341',
    timestamp: new Date().toISOString(),
    source: 'DEMO',
    hex: 'C017EA',
    type: seed.type,
    reg: seed.reg,
    painted_as: 'ACA',
    operating_as: JAZZ.icao,
    orig_iata: seed.origin,
    orig_icao: seed.originIcao,
    dest_iata: seed.dest,
    dest_icao: seed.destIcao,
    eta,
    sta,
  };
}

export function buildDemoAircraft(now = Date.now()): LiveAircraft[] {
  const elapsedSec = Math.max(0, (now - DEMO_STARTED) / 1000);
  return SEEDS.map((seed) => toLiveAircraft(advanceSeed(seed, elapsedSec))).filter(
    (aircraft): aircraft is LiveAircraft => Boolean(aircraft),
  );
}
