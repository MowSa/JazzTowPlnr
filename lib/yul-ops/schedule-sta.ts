import { flightKey } from '../gates.ts';
import { YUL } from './constants.ts';
import type { Report } from '../tows.ts';

export const STA_UPDATED_EVENT = 'yul-sta-updated';
const STORAGE_KEY = 'yul-sta-board';

let board = loadBoard();

function loadBoard() {
  const next = new Map<string, number[]>();
  if (typeof sessionStorage === 'undefined') return next;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
    for (const [key, times] of Object.entries(parsed)) {
      const values = (Array.isArray(times) ? times : [])
        .map(Number)
        .filter((ms) => Number.isFinite(ms));
      if (key && values.length) next.set(key, values);
    }
  } catch {
    /* Board still works when storage is unavailable. */
  }
  return next;
}

function persist(next: Map<string, number[]>) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(next)));
}

function emit() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(STA_UPDATED_EVENT));
}

/**
 * JazzTow CSV stamps store local wall-clock as UTC. Convert to a real instant
 * in the YUL timezone so STA can be compared to FR24 ETA.
 */
export function wallClockStampToUtc(stampMs: number, timeZone = YUL.timeZone) {
  if (!Number.isFinite(stampMs)) return undefined;
  const wall = new Date(stampMs).toISOString().slice(0, 19);
  const utcGuess = Date.parse(`${wall}Z`);
  if (!Number.isFinite(utcGuess)) return undefined;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcGuess));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const shown = `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
  const shownMs = Date.parse(`${shown}Z`);
  if (!Number.isFinite(shownMs)) return undefined;
  return utcGuess - (shownMs - utcGuess);
}

function isScheduled(label: string) {
  return /\sS\s*$/i.test(label);
}

export function clearScheduledArrivals() {
  board = new Map();
  persist(board);
  emit();
}

/** Incoming TOA rows marked S from the JazzTow turn-view CSV. */
export function publishScheduledArrivals(report: Report) {
  if (!report.turns.length) return;
  const next = new Map<string, number[]>();
  for (const turn of report.turns) {
    if (!turn.arrFlight || turn.arrival === null) continue;
    if (!isScheduled(turn.arrLabel)) continue;
    const key = flightKey(turn.arrFlight);
    if (!key) continue;
    const staMs = wallClockStampToUtc(turn.arrival);
    if (staMs === undefined) continue;
    const times = next.get(key) || [];
    if (!times.includes(staMs)) times.push(staMs);
    next.set(key, times);
  }
  board = next;
  persist(next);
  emit();
}

export function scheduledArrivalMs(flight?: string, aroundMs?: number) {
  if (!flight) return undefined;
  const key = flightKey(flight);
  const times = key ? board.get(key) : undefined;
  if (!times?.length) return undefined;
  if (aroundMs === undefined || !Number.isFinite(aroundMs)) return times[times.length - 1];
  return times.reduce((best, time) =>
    Math.abs(time - aroundMs) < Math.abs(best - aroundMs) ? time : best,
  );
}
