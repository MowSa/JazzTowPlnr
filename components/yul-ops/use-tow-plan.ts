'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  loadPlannerSnapshot,
  savePlannerSnapshot,
  type PlannerSnapshot,
} from '@/lib/planner-session';
import { linkTows, retimeMove } from '@/lib/yul-ops/tow-link';
import type { LiveAircraft } from '@/lib/yul-ops/types';

// The JazzTow desk lives in this tab's sessionStorage; /yul opens in the same
// tab, so the map reads (and re-times) the same working plan.
let plan: PlannerSnapshot | null | undefined;
const listeners = new Set<() => void>();

function getPlan() {
  if (plan === undefined) plan = loadPlannerSnapshot();
  return plan;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns false when the desk could not be saved (storage blocked or full). */
export function applyTowPickup(moveId: string, pickup: string) {
  const current = getPlan();
  if (!current) return false;
  const next = retimeMove(current, moveId, pickup);
  if (!savePlannerSnapshot(next)) return false;
  plan = next;
  for (const listener of listeners) listener();
  return true;
}

export function useTowLinks(aircraft: LiveAircraft[]) {
  const current = useSyncExternalStore(subscribe, getPlan, () => null);
  return useMemo(() => linkTows(current, aircraft), [current, aircraft]);
}
