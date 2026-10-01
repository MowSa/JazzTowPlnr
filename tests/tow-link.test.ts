import test from 'node:test';
import assert from 'node:assert/strict';
import { linkTows, retimeMove } from '../lib/yul-ops/tow-link.ts';
import type { PlannerSnapshot } from '../lib/planner-session.ts';
import type { Move, Report, Turn } from '../lib/tows.ts';
import type { LiveAircraft } from '../lib/yul-ops/types.ts';

void test('a late live ETA re-times the matching arrival tow and sends it back to review', () => {
  const at = (hhmm: string) => Date.parse(`2026-09-05T${hhmm}:00Z`);
  const report = { date: '2026-09-05', station: 'YUL', turns: [{ id: 't1', arrival: at('18:03') } as Turn] } as Report;
  const move = { id: 't1', turnId: 't1', arrFlight: 'QK8901', pickup: '18:05', earliest: at('18:05'), included: true, reviewed: true, actualPickup: '' } as Move;
  const plan = { report, moves: [move] } as PlannerSnapshot;
  // 22:22Z is 18:22 at YUL (EDT); another QK flight and an outbound do not match.
  const inbound = { id: 'a', flightNumber: 'AC8901', direction: 'INBOUND', eta: '2026-09-05T22:22:00Z' } as LiveAircraft;
  const links = linkTows(plan, [inbound, { ...inbound, id: 'b', flightNumber: 'AC8902' }, { ...inbound, id: 'c', direction: 'OUTBOUND' }]);
  assert.deepEqual([...links.keys()], ['a']);
  assert.deepEqual({ ...links.get('a'), move: undefined }, { move: undefined, planned: '18:05', etaPickup: '18:20', slipMin: 15, suggest: true });
  const updated = retimeMove(plan, 't1', '18:20').moves[0];
  assert.equal(updated.pickup, '18:20');
  assert.equal(updated.reviewed, false);
});
