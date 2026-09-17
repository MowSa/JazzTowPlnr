export function formatFt(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${Math.round(value).toLocaleString('en-US')} ft`;
}

export function formatKt(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${Math.round(value)} kt`;
}

export function formatFpm(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en-US')} ft/min`;
}

export function formatHeading(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${Math.round(value).toString().padStart(3, '0')}°`;
}

export function formatKm(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `${value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString('en-US')} km`;
}

export function formatClock(ms?: number, timeZone = 'UTC') {
  if (!ms || !Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(ms);
}

export function routeLabel(origin?: string, destination?: string) {
  if (!origin && !destination) return undefined;
  return `${origin || '—'} → ${destination || '—'}`;
}

export function flightLabel(aircraft: { flightNumber?: string; callsign?: string; id: string }) {
  return aircraft.flightNumber || aircraft.callsign || aircraft.id;
}

export function formatDuration(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  const total = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function formatAgo(from: number, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function formatCountdown(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function nextLiveUpdateLabel(nextPollAt: number, now: number) {
  if (!Number.isFinite(nextPollAt) || nextPollAt <= 0) return 'Updating…';
  const remaining = nextPollAt - now;
  if (remaining <= 0) return 'Updating…';
  return `Next update ${formatCountdown(remaining)}`;
}

export function formatClockShort(ms?: number, timeZone = 'UTC') {
  if (!ms || !Number.isFinite(ms)) return undefined;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(ms);
}
