import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, makeMoves, type Move } from '../lib/tows.ts';
import { sampleCSV } from './fixtures/sample.ts';
import {
  PLANNER_SESSION_KEY,
  PLANNER_SESSION_VERSION,
  clearPlannerSnapshot,
  loadPlannerSnapshot,
  nextIncludedPickup,
  parsePlannerSnapshot,
  savePlannerSnapshot,
  type PlannerSnapshot,
} from '../lib/planner-session.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data),
  };
}

function move(partial: Partial<Move> & Pick<Move, 'id' | 'fin' | 'pickup'>): Move {
  return {
    turnId: 't',
    arrFlight: 'QK1',
    depFlight: 'QK2',
    from: '74',
    to: 'BSE',
    release: '',
    gateOpen: '',
    actualPickup: '',
    actualDrop: '',
    depTime: '',
    tower: '',
    kind: 'gate',
    included: true,
    reviewed: true,
    reason: '',
    earliest: null,
    latest: null,
    warnings: [],
    ...partial,
  };
}

function snapshot(overrides: Partial<PlannerSnapshot> = {}): PlannerSnapshot {
  const report = analyze(sampleCSV);
  return {
    v: PLANNER_SESSION_VERSION,
    uploadedAt: 1,
    report,
    moves: makeMoves(report),
    fileName: 'qa-turn-view.csv',
    aircraftNotes: {},
    overnightSnapshot: {
      rows: [],
      date: '',
      dirty: false,
      generated: false,
      required: '',
      allowed: '',
      source: '',
    },
    airport: null,
    decisions: {},
    holding: {},
    dateOverride: '',
    boardFilter: 'all',
    tab: 'overview',
    ...overrides,
  };
}

void test('planner snapshot round-trips through session storage', () => {
  const store = memory();
  const snap = snapshot({
    aircraftNotes: { '427': 'Hold for inbound' },
    tab: 'moves',
    overnightSnapshot: {
      rows: [{ fin: '427' } as never],
      date: '2026-09-05',
      dirty: true,
      generated: true,
      required: '427',
      allowed: '',
      source: '["2026-09-05","427",""]',
    },
  });
  assert.equal(savePlannerSnapshot(snap, store), true);
  const loaded = loadPlannerSnapshot(store);
  assert.equal(loaded?.fileName, 'qa-turn-view.csv');
  assert.equal(loaded?.tab, 'moves');
  assert.equal(loaded?.aircraftNotes['427'], 'Hold for inbound');
  assert.equal(loaded?.overnightSnapshot.required, '427');
  assert.equal(loaded?.overnightSnapshot.rows[0]?.fin, '427');
  assert.equal(parsePlannerSnapshot('{"v":0,"report":{},"moves":[]}'), null);
  assert.equal(parsePlannerSnapshot('not-json'), null);
  clearPlannerSnapshot(store);
  assert.equal(loadPlannerSnapshot(store), null);
  assert.equal(store.dump()[PLANNER_SESSION_KEY], undefined);
});

void test('quota fallback drops the airport plan then gives up', () => {
  const store = memory();
  let calls = 0;
  const limited = {
    getItem: store.getItem,
    removeItem: store.removeItem,
    setItem: (key: string, value: string) => {
      calls += 1;
      if (calls === 1) throw new Error('QuotaExceededError');
      store.setItem(key, value);
    },
  };
  const snap = snapshot({
    airport: { name: 'YUL.xlsx', date: '2026-09-05', assignments: [], occupancies: [], warnings: [] },
  });
  assert.equal(savePlannerSnapshot(snap, limited), true);
  assert.equal(loadPlannerSnapshot(store)?.airport, null);
  const failing = {
    getItem: store.getItem,
    removeItem: store.removeItem,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(savePlannerSnapshot(snap, failing), false);
  assert.equal(loadPlannerSnapshot(store), null);
});

void test('next included pickup prefers in-progress, then upcoming, then remaining', () => {
  const date = '2026-09-05';
  const now = Date.parse('2026-09-05T12:00:00Z');
  const open = [
    move({ id: 'past', fin: '111', pickup: '08:00' }),
    move({ id: 'next', fin: '222', pickup: '14:25', from: '74', to: 'BSE' }),
    move({ id: 'later', fin: '333', pickup: '18:00' }),
  ];
  assert.equal(nextIncludedPickup(open, date, now)?.id, 'next');
  assert.equal(
    nextIncludedPickup(
      [
        move({ id: 'live', fin: '999', pickup: '08:00', actualPickup: '08:04' }),
        ...open,
      ],
      date,
      now,
    )?.id,
    'live',
  );
  assert.equal(
    nextIncludedPickup(
      [
        move({ id: 'done', fin: '000', pickup: '07:00', actualDrop: '07:20' }),
        move({ id: 'out', fin: '444', pickup: '14:00', included: false }),
        ...open,
      ],
      date,
      now,
    )?.id,
    'next',
  );
  assert.equal(nextIncludedPickup(open, date, Date.parse('2026-09-05T23:00:00Z'))?.id, 'past');
  assert.equal(nextIncludedPickup(open, date, null)?.id, 'past');
  assert.equal(nextIncludedPickup(open, '', now), null);
});
