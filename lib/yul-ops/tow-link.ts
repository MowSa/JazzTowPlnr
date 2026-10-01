import { stationWallClockStamp } from '../console.ts';
import { flightKey } from '../gates.ts';
import { clock, roundPickup, type Move, type Report } from '../tows.ts';
import type { PlannerSnapshot } from '../planner-session.ts';
import type { LiveAircraft } from './types.ts';

/** Only pair a live flight with a turn whose scheduled arrival is this close to its ETA. */
const MATCH_WINDOW_MS = 6 * 60 * 60_000;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type TowLink = {
  move: Move;
  /** HH:MM pickup currently on the tow plan. */
  planned: string;
  /** HH:MM pickup implied by the live ETA, rounded like a TOA pickup. */
  etaPickup: string;
  /** etaPickup minus planned, in minutes. */
  slipMin: number;
  /** The plan should move to etaPickup: the aircraft lands after the pickup, or earlier on a purely arrival-timed pickup. */
  suggest: boolean;
};

type TowPlan = Pick<PlannerSnapshot, 'report' | 'moves'>;

const wallMs = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00Z`);

/**
 * Arrival-side tow moves for live inbound flights. Moves are matched by
 * normalized flight number (AC/QK/JZA/ACA are one carrier) and the nearest
 * scheduled arrival. Started moves are shown but never re-timed.
 */
export function linkTows(plan: TowPlan | null, aircraft: LiveAircraft[]) {
  const links = new Map<string, TowLink>();
  const { report, moves } = plan ?? { report: null, moves: [] };
  if (!report?.date || !moves.length) return links;
  const turns = new Map(report.turns.map((t) => [t.id, t]));
  const byFlight = new Map<string, Move[]>();
  for (const move of moves) {
    if (!move.included || !move.arrFlight || !TIME.test(move.pickup)) continue;
    const key = flightKey(move.arrFlight);
    if (key) byFlight.set(key, [...(byFlight.get(key) ?? []), move]);
  }
  for (const item of aircraft) {
    if (item.direction !== 'INBOUND' || !item.eta) continue;
    const etaMs = Date.parse(item.eta);
    if (!Number.isFinite(etaMs)) continue;
    const candidates =
      byFlight.get(flightKey(item.flightNumber || '')) ??
      byFlight.get(flightKey(item.callsign || ''));
    if (!candidates) continue;
    // Null when the ETA is not on the sheet's operating date: that tow belongs to another sheet.
    const etaStamp = stationWallClockStamp(etaMs, report.station, report.date);
    if (etaStamp === null) continue;
    const move = nearest(candidates, turns, report, etaStamp);
    if (move) links.set(item.id, towLink(move, report.date, etaStamp));
  }
  return links;
}

function nearest(
  candidates: Move[],
  turns: Map<string, Report['turns'][number]>,
  report: Report,
  etaStamp: number,
) {
  let best: Move | null = null;
  let bestGap = MATCH_WINDOW_MS;
  for (const move of candidates) {
    const arrival = turns.get(move.turnId)?.arrival ?? wallMs(report.date, move.pickup);
    const gap = Math.abs(arrival - etaStamp);
    if (gap <= bestGap) {
      best = move;
      bestGap = gap;
    }
  }
  return best;
}

function towLink(move: Move, date: string, etaStamp: number): TowLink {
  const planned = wallMs(date, move.pickup);
  const rounded = roundPickup(etaStamp)!;
  const slipMin = Math.round((rounded - planned) / 60_000);
  const started = TIME.test(move.actualPickup);
  // Gate-occupancy pickups sit after arrival on purpose; only a later arrival should move them.
  const arrivalTimed = move.earliest === planned;
  return {
    move,
    planned: move.pickup,
    etaPickup: clock(rounded),
    slipMin,
    suggest: !started && (slipMin > 0 || (slipMin < 0 && arrivalTimed)),
  };
}

/**
 * Re-time one move in the stored planner desk. The move goes back to
 * unreviewed so the coordinator confirms it on the tow plan before issuing.
 */
export function retimeMove(plan: PlannerSnapshot, moveId: string, pickup: string): PlannerSnapshot {
  if (!TIME.test(pickup)) return plan;
  const at = wallMs(plan.report.date, pickup);
  return {
    ...plan,
    moves: plan.moves.map((m) =>
      m.id !== moveId
        ? m
        : {
            ...m,
            pickup,
            reviewed: false,
            earliest: m.earliest !== null && at < m.earliest ? at : m.earliest,
          },
    ),
  };
}
