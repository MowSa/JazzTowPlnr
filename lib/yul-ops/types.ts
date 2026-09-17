export type FlightDirection = 'INBOUND' | 'OUTBOUND';
export type DataMode = 'demo' | 'live';
export type FeedStatus = 'ok' | 'delayed' | 'error';
export type FieldSource = 'fr24' | 'calculated' | 'interpolated';

export interface LiveAircraft {
  id: string;
  flightNumber?: string;
  callsign?: string;
  registration?: string;
  aircraftType?: string;
  operator?: string;
  operatorIcao?: string;
  paintedAs?: string;
  origin?: string;
  originIcao?: string;
  destination?: string;
  destinationIcao?: string;
  eta?: string;
  /** Scheduled arrival, when known. Never inferred from ETA. */
  sta?: string;
  latitude: number;
  longitude: number;
  altitudeFt?: number;
  groundSpeedKt?: number;
  verticalSpeedFpm?: number;
  headingDeg?: number;
  squawk?: string;
  transponderHex?: string;
  positionSource?: string;
  distanceFromYulKm?: number;
  direction: FlightDirection;
  lastUpdated: number;
}

export interface LiveFlightsResponse {
  mode: DataMode;
  status: FeedStatus;
  fetchedAt: number;
  refreshIntervalMs: number;
  staleAfterMs: number;
  aircraft: LiveAircraft[];
  error?: string;
  notice?: string;
}

export interface Fr24LivePosition {
  fr24_id?: string;
  flight?: string | null;
  callsign?: string | null;
  lat?: number | null;
  lon?: number | null;
  track?: number | null;
  alt?: number | null;
  gspeed?: number | null;
  vspeed?: number | null;
  squawk?: string | number | null;
  timestamp?: string | null;
  source?: string | null;
  hex?: string | null;
  type?: string | null;
  reg?: string | null;
  painted_as?: string | null;
  operating_as?: string | null;
  orig_iata?: string | null;
  orig_icao?: string | null;
  dest_iata?: string | null;
  dest_icao?: string | null;
  eta?: string | null;
  sta?: string | null;
}

export interface Fr24LivePositionsResponse {
  data?: Fr24LivePosition[];
}

export interface FlightFilters {
  direction: 'ALL' | FlightDirection;
  aircraftType: string;
  airport: string;
  registration: string;
  flightNumber: string;
  query: string;
}

export interface InterpolatedPose {
  latitude: number;
  longitude: number;
  altitudeFt: number;
  headingDeg: number;
  /** Visualization only — not an FR24 value. */
  source: 'interpolated';
}
