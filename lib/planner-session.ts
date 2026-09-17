import { type AirportPlan } from './gates.ts';
import { type ShutdownRow } from './shutdown.ts';
import { type Move, type Report } from './tows.ts';
import { stationWallClockStamp, type BoardFilter } from './console.ts';

export type OvernightSnapshot = {
  rows: ShutdownRow[];
  date: string;
  dirty: boolean;
  generated: boolean;
  required?: string;
  allowed?: string;
  source?: string;
};

export const PLANNER_SESSION_KEY = 'jazztow-desk';
export const PLANNER_SESSION_VERSION = 1;

export type PlannerSnapshot = {
  v: typeof PLANNER_SESSION_VERSION;
  uploadedAt: number | null;
  report: Report;
  moves: Move[];
  fileName: string;
  aircraftNotes: Record<string, string>;
  overnightSnapshot: OvernightSnapshot;
  airport: AirportPlan | null;
  decisions: Record<string, string>;
  holding: Record<string, string>;
  dateOverride: string;
  boardFilter: BoardFilter | 'ready' | 'excluded';
  tab: string;
};

const emptyOvernight = (): OvernightSnapshot => ({
  rows: [],
  date: '',
  dirty: false,
  generated: false,
  required: '',
  allowed: '',
  source: '',
});

export function parsePlannerSnapshot(raw: string | null): PlannerSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PlannerSnapshot>;
    if (value.v !== PLANNER_SESSION_VERSION || !value.report || !Array.isArray(value.moves))
      return null;
    if (typeof value.report.date !== 'string' || typeof value.report.station !== 'string')
      return null;
    return {
      v: PLANNER_SESSION_VERSION,
      uploadedAt: typeof value.uploadedAt === 'number' ? value.uploadedAt : null,
      report: value.report,
      moves: value.moves,
      fileName: typeof value.fileName === 'string' ? value.fileName : '',
      aircraftNotes:
        value.aircraftNotes && typeof value.aircraftNotes === 'object'
          ? value.aircraftNotes
          : {},
      overnightSnapshot: value.overnightSnapshot &&
        typeof value.overnightSnapshot === 'object'
        ? {
            ...emptyOvernight(),
            ...value.overnightSnapshot,
            rows: Array.isArray(value.overnightSnapshot.rows)
              ? value.overnightSnapshot.rows
              : [],
          }
        : emptyOvernight(),
      airport: value.airport ?? null,
      decisions: value.decisions && typeof value.decisions === 'object' ? value.decisions : {},
      holding: value.holding && typeof value.holding === 'object' ? value.holding : {},
      dateOverride: typeof value.dateOverride === 'string' ? value.dateOverride : '',
      boardFilter: value.boardFilter || 'all',
      tab: typeof value.tab === 'string' && value.tab ? value.tab : 'overview',
    };
  } catch {
    return null;
  }
}

export function serializePlannerSnapshot(snapshot: PlannerSnapshot): string {
  return JSON.stringify(snapshot);
}

export function loadPlannerSnapshot(storage?: Pick<Storage, 'getItem'> | null) {
  try {
    const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
    return parsePlannerSnapshot(store?.getItem(PLANNER_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function savePlannerSnapshot(
  snapshot: PlannerSnapshot,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null,
) {
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) return false;
  const payload = serializePlannerSnapshot(snapshot);
  try {
    store.setItem(PLANNER_SESSION_KEY, payload);
    return true;
  } catch {
    try {
      store.setItem(
        PLANNER_SESSION_KEY,
        serializePlannerSnapshot({ ...snapshot, airport: null }),
      );
      return true;
    } catch {
      try {
        store.removeItem(PLANNER_SESSION_KEY);
      } catch {
        /* Quota still unavailable. */
      }
      return false;
    }
  }
}

export function clearPlannerSnapshot(storage?: Pick<Storage, 'removeItem'> | null) {
  try {
    const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
    store?.removeItem(PLANNER_SESSION_KEY);
  } catch {
    /* Storage may be blocked. */
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function nextIncludedPickup(
  moves: Move[],
  date: string,
  nowStamp: number | null,
): Move | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const open = moves.filter(
    (m) => m.included && TIME.test(m.pickup) && !TIME.test(m.actualDrop),
  );
  const at = (m: Move) => Date.parse(`${date}T${m.pickup}:00Z`);
  open.sort((a, b) => at(a) - at(b) || a.fin.localeCompare(b.fin));
  const inProgress = open.find((m) => TIME.test(m.actualPickup));
  if (inProgress) return inProgress;
  if (nowStamp === null) return open[0] ?? null;
  return open.find((m) => at(m) >= nowStamp) ?? open[0] ?? null;
}

export function nextPickupNowStamp(nowMs: number, station: string, date: string) {
  return stationWallClockStamp(nowMs, station, date);
}
