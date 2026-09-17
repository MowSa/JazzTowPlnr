/** Official CYUL / YUL reference point (WGS84). */
export const YUL = {
  iata: 'YUL',
  icao: 'CYUL',
  name: 'Montréal–Trudeau International Airport',
  latitude: 45.470556,
  longitude: -73.740833,
  elevationFt: 118,
  timeZone: 'America/Toronto',
} as const;

/**
 * Jazz Aviation identifiers.
 * Flight numbers are often marketed as Air Canada Express (AC), so AC prefixes
 * are never used as the Jazz operator test. FR24 `operating_as` ICAO is the
 * primary key; callsign prefix JZA is a fallback when operating_as is absent.
 */
export const JAZZ = {
  icao: 'JZA',
  iata: 'QK',
  name: 'Jazz Aviation',
  marketedAs: 'Air Canada Express',
  callsignPrefix: 'JZA',
} as const;

export const YUL_AIRPORT_CODES = new Set(['YUL', 'CYUL']);

/** Default Explorer-conscious poll (ms). Override with FR24_REFRESH_INTERVAL. */
export const DEFAULT_REFRESH_MS = 120_000;
/** Never poll FR24 faster than this, regardless of env (Explorer is 10 req/min). */
export const MIN_REFRESH_MS = 15_000;
/** Mark silent aircraft stale and freeze them; age alone never removes them. */
export const DEFAULT_STALE_MS = 15 * 60_000;
export const FR24_LIVE_FULL_PATH = '/live/flight-positions/full';
export const FR24_API_BASE = 'https://fr24api.flightradar24.com/api';
export const FR24_CREDITS_PER_FULL_POSITION = 8;
export const FR24_EMPTY_RESULT_CREDITS = 1;
export const FR24_EXPLORER_CREDITS_PER_MONTH = 30_000;
export const FR24_EXPLORER_REQUESTS_PER_MINUTE = 10;
export const CESIUM_VERSION = '1.145.0';
export const CESIUM_CDN_BASE = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;
/** Below this MSL altitude a Jazz aircraft is treated as taxiing. */
export const TAXIING_ALTITUDE_FT = 1_000;
/** Inbound flights are "Arriving" only inside this window. */
export const ARRIVING_WINDOW_MS = 15 * 60_000;
/** Toast airborne inbound flights whose ETA or STA is within this window of now. */
export const ARRIVAL_ALERT_WINDOW_MS = 30 * 60_000;
