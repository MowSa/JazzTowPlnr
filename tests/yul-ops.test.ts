import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { distanceFromYulKm, destinationPoint, bearingDeg } from '../lib/yul-ops/geo.ts';
import { filterJazzYul, isJazzOperator, toLiveAircraft } from '../lib/yul-ops/filter.ts';
import { parseFr24LivePositions, buildLivePositionsUrl } from '../lib/yul-ops/fr24.ts';
import { createTrack, applySnapshot, advanceTrack } from '../lib/yul-ops/interpolate.ts';
import { buildDemoAircraft } from '../lib/yul-ops/demo.ts';
import { formatClockShort } from '../lib/yul-ops/format.ts';
import { YUL } from '../lib/yul-ops/constants.ts';
import type { Fr24LivePosition } from '../lib/yul-ops/types.ts';

const jazzYulInbound: Fr24LivePosition = {
  fr24_id: 'abc123',
  flight: 'AC8901',
  callsign: 'JZA8901',
  lat: 45.5,
  lon: -73.9,
  track: 90,
  alt: 8000,
  gspeed: 280,
  vspeed: -900,
  operating_as: 'JZA',
  painted_as: 'ACA',
  orig_iata: 'YYZ',
  orig_icao: 'CYYZ',
  dest_iata: 'YUL',
  dest_icao: 'CYUL',
  type: 'CRJ9',
  reg: 'C-GJZD',
  timestamp: '2026-09-15T18:00:00Z',
};

void test('YUL distance uses geodesic kilometres', () => {
  assert.equal(Math.round(distanceFromYulKm(45.470556, -73.740833)), 0);
  const kingston = distanceFromYulKm(44.231, -76.486);
  assert.ok(kingston > 200 && kingston < 280);
});

void test('Jazz filter uses operating_as JZA, not AC flight numbers', () => {
  assert.equal(isJazzOperator(jazzYulInbound), true);
  assert.equal(isJazzOperator({ ...jazzYulInbound, operating_as: 'ACA', callsign: 'ACA8901' }), false);
  const mainline = toLiveAircraft({
    ...jazzYulInbound,
    operating_as: 'ACA',
    callsign: 'ACA123',
    flight: 'AC123',
  });
  assert.equal(mainline, null);
});

void test('YUL inbound/outbound and non-YUL Jazz flights', () => {
  const inbound = toLiveAircraft(jazzYulInbound);
  assert.equal(inbound?.direction, 'INBOUND');
  const outbound = toLiveAircraft({
    ...jazzYulInbound,
    orig_iata: 'YUL',
    orig_icao: 'CYUL',
    dest_iata: 'YOW',
    dest_icao: 'CYOW',
  });
  assert.equal(outbound?.direction, 'OUTBOUND');
  const elsewhere = toLiveAircraft({
    ...jazzYulInbound,
    orig_iata: 'YYZ',
    dest_iata: 'YVR',
    orig_icao: 'CYYZ',
    dest_icao: 'CYVR',
  });
  assert.equal(elsewhere, null);
});

void test('FR24 adapter parses data[] and requests operating_as plus both:YUL', () => {
  const parsed = parseFr24LivePositions(JSON.stringify({ data: [jazzYulInbound] }));
  assert.equal(parsed.length, 1);
  assert.equal(filterJazzYul(parsed)[0]?.flightNumber, 'AC8901');
  const url = buildLivePositionsUrl();
  assert.equal(url.origin + url.pathname, 'https://fr24api.flightradar24.com/api/live/flight-positions/full');
  assert.equal(url.searchParams.get('operating_as'), 'JZA');
  assert.equal(url.searchParams.get('airports'), 'both:YUL');
});

void test('interpolation dead-reckons instead of teleporting', () => {
  // Synthetic clock: lastUpdated must sit within the clock-skew window of now=0.
  const live = { ...toLiveAircraft(jazzYulInbound)!, lastUpdated: 1 };
  const track = createTrack(live, 0);
  applySnapshot(track, { ...live, longitude: live.longitude - 0.4 }, 0);
  const later = advanceTrack(track, 60_000);
  assert.notEqual(later.longitude, live.longitude);
  assert.equal(later.source, 'interpolated');
});

void test('demo mode yields Jazz YUL inbound and outbound aircraft', () => {
  const aircraft = buildDemoAircraft();
  assert.ok(aircraft.some((item) => item.direction === 'INBOUND'));
  assert.ok(aircraft.some((item) => item.direction === 'OUTBOUND'));
  assert.ok(aircraft.every((item) => item.operatorIcao === 'JZA'));
  assert.ok(aircraft.every((item) => item.origin === 'YUL' || item.destination === 'YUL'));
});

void test('bearing toward YUL is finite', () => {
  const heading = bearingDeg(44.23, -76.49, 45.470556, -73.740833);
  const moved = destinationPoint(44.23, -76.49, heading, 10_000);
  assert.ok(heading >= 0 && heading < 360);
  assert.ok(moved.latitude > 44.23);
});

void test('inbound progress uses origin distance and does not exceed 99%', async () => {
  const { routeProgress } = await import('../lib/yul-ops/progress.ts');
  const progress = routeProgress({
    id: 'x',
    direction: 'INBOUND',
    origin: 'YYZ',
    destination: 'YUL',
    latitude: 45.2,
    longitude: -74.2,
    distanceFromYulKm: 80,
    lastUpdated: Date.now(),
  });
  assert.equal(typeof progress.percent, 'number');
  assert.ok((progress.percent ?? 0) > 0 && (progress.percent ?? 0) < 100);
});

void test('flight phase is taxiing, airborne, or arriving within 15 minutes', async () => {
  const { flightPhase } = await import('../lib/yul-ops/status.ts');
  const now = Date.parse('2026-09-15T18:00:00Z');
  const base = {
    id: 'x',
    latitude: 45.4,
    longitude: -73.8,
    lastUpdated: now,
  } as const;
  assert.equal(
    flightPhase({ ...base, direction: 'INBOUND', altitudeFt: 200, destination: 'YUL' }, now),
    'taxiing',
  );
  assert.equal(
    flightPhase(
      { ...base, direction: 'OUTBOUND', altitudeFt: 18000, origin: 'YUL', destination: 'YOW' },
      now,
    ),
    'airborne',
  );
  assert.equal(
    flightPhase(
      {
        ...base,
        direction: 'INBOUND',
        altitudeFt: 8000,
        origin: 'YOW',
        destination: 'YUL',
        eta: '2026-09-15T18:40:00Z',
        groundSpeedKt: 280,
        distanceFromYulKm: 120,
      },
      now,
    ),
    'airborne',
  );
  assert.equal(
    flightPhase(
      {
        ...base,
        direction: 'INBOUND',
        altitudeFt: 8000,
        origin: 'YOW',
        destination: 'YUL',
        eta: '2026-09-15T18:10:00Z',
        groundSpeedKt: 280,
        distanceFromYulKm: 40,
      },
      now,
    ),
    'arriving',
  );
});

void test('estimated clocks report Zulu and YUL local time', () => {
  const ms = Date.parse('2026-09-16T18:42:00Z');
  assert.equal(formatClockShort(ms), '18:42');
  assert.equal(formatClockShort(ms, YUL.timeZone), '14:42');
});

void test('toast history keeps newest notices first and ignores duplicate ids', async () => {
  const { recordToastNotice, getToastHistory } = await import('../lib/yul-ops/toast-history.ts');
  recordToastNotice({
    id: 'hist-old',
    flightLabel: 'AC1000',
    kind: 'early',
    detail: 'YOW → YUL · 6m',
    shownAt: 1_000,
  });
  recordToastNotice({
    id: 'hist-new',
    flightLabel: 'AC2000',
    kind: 'late',
    detail: 'YTZ → YUL · 12m',
    shownAt: 2_000,
  });
  recordToastNotice({
    id: 'hist-old',
    flightLabel: 'AC1000',
    kind: 'early',
    detail: 'YOW → YUL · 6m',
    shownAt: 3_000,
  });
  const history = getToastHistory();
  const indexNew = history.findIndex((item) => item.id === 'hist-new');
  const indexOld = history.findIndex((item) => item.id === 'hist-old');
  assert.ok(indexNew >= 0 && indexOld >= 0);
  assert.ok(indexNew < indexOld);
  assert.equal(history.filter((item) => item.id === 'hist-old').length, 1);
});

void test('arrival toasts flag early or late airborne arrivals against STA', async () => {
  const { clearScheduledArrivals } = await import('../lib/yul-ops/schedule-sta.ts');
  clearScheduledArrivals();
  const { arrivalAlert, arrivalAlertHeadline, arrivalAlertClocks } = await import(
    '../lib/yul-ops/arrival-alert.ts'
  );
  const now = Date.parse('2026-09-15T18:00:00Z');
  const base = {
    id: 'toast-1',
    latitude: 45.5,
    longitude: -73.9,
    lastUpdated: now,
    origin: 'YOW',
    destination: 'YUL',
    flightNumber: 'AC8901',
    eta: '2026-09-15T18:20:00Z',
    sta: '2026-09-15T18:08:00Z',
  };
  const late = arrivalAlert({ ...base, direction: 'INBOUND', altitudeFt: 8000 }, now);
  assert.equal(late?.kind, 'late');
  assert.equal(late?.varianceMs, 12 * 60_000);
  assert.equal(arrivalAlertHeadline(late!), 'AC8901 late');
  assert.equal(arrivalAlertClocks(late!), 'ETA 14:20 · STA 14:08');
  assert.equal(
    arrivalAlert({ ...base, direction: 'INBOUND', altitudeFt: 200 }, now),
    null,
  );
  assert.equal(
    arrivalAlert({ ...base, direction: 'OUTBOUND', altitudeFt: 18000 }, now),
    null,
  );
  assert.equal(
    arrivalAlert(
      {
        ...base,
        direction: 'INBOUND',
        altitudeFt: 8000,
        eta: '2026-09-15T18:45:00Z',
        sta: '2026-09-15T18:45:00Z',
      },
      now,
    ),
    null,
  );
  assert.equal(
    arrivalAlert({ ...base, direction: 'INBOUND', altitudeFt: 8000, sta: undefined }, now),
    null,
  );
  const early = arrivalAlert(
    { ...base, direction: 'INBOUND', altitudeFt: 8000, eta: '2026-09-15T18:12:00Z', sta: '2026-09-15T18:20:00Z' },
    now,
  );
  assert.equal(early?.kind, 'early');
  assert.equal(early?.varianceMs, -8 * 60_000);
  assert.equal(arrivalAlertHeadline(early!), 'AC8901 early');
});

void test('CSV scheduled arrivals convert local wall-clock stamps to UTC', async () => {
  const { wallClockStampToUtc, publishScheduledArrivals, scheduledArrivalMs } = await import(
    '../lib/yul-ops/schedule-sta.ts'
  );
  const stamp = Date.parse('2026-09-16T08:00:00Z');
  assert.equal(wallClockStampToUtc(stamp), Date.parse('2026-09-16T12:00:00Z'));
  publishScheduledArrivals({
    date: '2026-09-16',
    station: 'YUL',
    cancelled: 0,
    duplicates: 0,
    warnings: [],
    turns: [
      {
        id: 'turn-1',
        row: 1,
        fin: '431',
        arrFlight: 'QK 7777',
        depFlight: 'QK 8902',
        origin: 'YOW',
        destination: 'YYZ',
        from: '02',
        to: '02',
        rawFrom: '/ 02',
        rawTo: '/ 02',
        arrival: stamp,
        departure: stamp + 3 * 3600_000,
        arrLabel: '0800/16 S',
        depLabel: '1100/16 S',
        duration: 180,
        kind: 'none',
        reason: '',
        warnings: [],
      },
    ],
  });
  assert.equal(scheduledArrivalMs('AC7777'), Date.parse('2026-09-16T12:00:00Z'));
});

void test('turn-view Incoming TOA S is STA for live AC/QK/JZA flights', async () => {
  const { analyze } = await import('../lib/tows.ts');
  const { arrivalAlert } = await import('../lib/yul-ops/arrival-alert.ts');
  const { publishScheduledArrivals, scheduledArrivalMs, wallClockStampToUtc } = await import(
    '../lib/yul-ops/schedule-sta.ts'
  );
  const csv = await readFile(new URL('./fixtures/turn-view-yul-sta.csv', import.meta.url), 'utf8');
  const report = analyze(csv);
  publishScheduledArrivals(report);
  const sta = wallClockStampToUtc(Date.parse('2026-09-15T18:45:00Z'));
  assert.equal(sta, Date.parse('2026-09-15T22:45:00Z'));
  assert.equal(scheduledArrivalMs('QK 7970'), sta);
  assert.equal(scheduledArrivalMs('AC7970'), sta);
  assert.equal(scheduledArrivalMs('JZA7970'), sta);
  assert.equal(scheduledArrivalMs('AC8010'), undefined);
  const now = Date.parse('2026-09-15T22:30:00Z');
  const alert = arrivalAlert(
    {
      id: 'live-7970',
      latitude: 45.5,
      longitude: -73.9,
      lastUpdated: now,
      origin: 'YTZ',
      destination: 'YUL',
      flightNumber: 'AC7970',
      callsign: 'JZA7970',
      eta: '2026-09-15T22:57:00Z',
      direction: 'INBOUND',
      altitudeFt: 8000,
    },
    now,
  );
  assert.equal(alert?.kind, 'late');
  assert.equal(alert?.varianceMs, 12 * 60_000);
  assert.equal(alert?.staMs, sta);
});
