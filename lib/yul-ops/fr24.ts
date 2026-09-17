import {
  FR24_API_BASE,
  FR24_LIVE_FULL_PATH,
  JAZZ,
} from './constants.ts';
import type { Fr24LivePosition } from './types.ts';

export const FR24_TIMEOUT_MS = 10_000;

export class Fr24RequestError extends Error {
  retryAfterMs: number;

  constructor(status: number, retryAfterMs = 0) {
    super(`FR24 request failed (HTTP ${status}).`);
    this.name = 'Fr24RequestError';
    this.retryAfterMs = retryAfterMs;
  }
}

function retryDelay(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

export function buildLivePositionsUrl() {
  const url = new URL(FR24_API_BASE + FR24_LIVE_FULL_PATH);
  url.searchParams.set('operating_as', JAZZ.icao);
  url.searchParams.set('airports', 'both:YUL');
  url.searchParams.set('categories', 'P');
  url.searchParams.set('limit', '100');
  return url;
}

export function fr24Headers(apiKey: string) {
  return {
    Accept: 'application/json',
    'Accept-Version': 'v1',
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function fetchFr24LivePositions(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = FR24_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(buildLivePositionsUrl(), {
      headers: fr24Headers(apiKey),
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      // Do not forward arbitrary provider response bodies to the browser.
      throw new Fr24RequestError(response.status, retryDelay(response.headers.get('Retry-After')));
    }
    return parseFr24LivePositions(await response.text());
  } catch (error) {
    if (controller.signal.aborted) throw new Error('FR24 request timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseFr24LivePositions(body: string): Fr24LivePosition[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('FR24 returned a non-JSON body');
  }
  if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !Array.isArray(parsed.data)) {
    throw new Error('FR24 returned an invalid flight positions response.');
  }
  const positions: Fr24LivePosition[] = [];
  for (const row of parsed.data) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        typeof row.lat !== 'number' || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90 ||
        typeof row.lon !== 'number' || !Number.isFinite(row.lon) || Math.abs(row.lon) > 180) {
      throw new Error('FR24 returned an invalid aircraft position.');
    }
    const strings = ['fr24_id', 'flight', 'callsign', 'timestamp', 'source', 'hex', 'type', 'reg',
      'painted_as', 'operating_as', 'orig_iata', 'orig_icao', 'dest_iata', 'dest_icao', 'eta', 'sta'];
    const numbers = ['track', 'alt', 'gspeed', 'vspeed'];
    if (strings.some((key) => row[key] != null && typeof row[key] !== 'string') ||
        numbers.some((key) => row[key] != null && (typeof row[key] !== 'number' || !Number.isFinite(row[key])))) {
      throw new Error('FR24 returned invalid aircraft fields.');
    }
    positions.push(row as Fr24LivePosition);
  }
  return positions;
}
