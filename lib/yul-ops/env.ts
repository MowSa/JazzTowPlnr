import {
  DEFAULT_REFRESH_MS,
  DEFAULT_STALE_MS,
  MIN_REFRESH_MS,
} from './constants.ts';

function truthy(value: string | undefined) {
  return value === '1' || value === 'true' || value === 'TRUE';
}

export function isDemoMode() {
  if (truthy(process.env.NEXT_PUBLIC_DEMO_MODE) || truthy(process.env.DEMO_MODE)) return true;
  return !fr24ApiKey();
}

export function fr24ApiKey() {
  return process.env.FR24_API_KEY?.trim() || '';
}

export function cesiumIonToken() {
  return process.env.CESIUM_ION_TOKEN?.trim() || '';
}

export function refreshIntervalMs(demo: boolean) {
  if (demo) return 8_000;
  const raw = Number(process.env.FR24_REFRESH_INTERVAL);
  if (Number.isFinite(raw) && raw > 0) return Math.max(MIN_REFRESH_MS, raw);
  return DEFAULT_REFRESH_MS;
}

export function staleAfterMs() {
  const raw = Number(process.env.FR24_STALE_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_STALE_MS;
}
