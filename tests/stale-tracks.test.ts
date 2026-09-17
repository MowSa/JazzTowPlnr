import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationPoint } from '../lib/yul-ops/geo.ts';
import { createTrack, applySnapshot, advanceTrack, syncTracks, deadReckon } from '../lib/yul-ops/interpolate.ts';
import { isFeedStale, isAircraftStale, freshArrivalAircraft, timestampAgeMs, MAX_EXTRAPOLATION_MS } from '../lib/yul-ops/freshness.ts';
import { arrivalAlerts } from '../lib/yul-ops/arrival-alert.ts';
import type { LiveAircraft, LiveFlightsResponse } from '../lib/yul-ops/types.ts';

const now = Date.parse('2026-09-16T18:00:00Z');
function aircraft(overrides: Partial<LiveAircraft> = {}): LiveAircraft {
  return {
    id: 'stale-1', latitude: 45.5, longitude: -73.9, direction: 'INBOUND',
    altitudeFt: 8_000, groundSpeedKt: 280, verticalSpeedFpm: -900, headingDeg: 90,
    lastUpdated: now - 5_000, ...overrides,
  };
}
function feed(overrides: Partial<LiveFlightsResponse> = {}): LiveFlightsResponse {
  return {
    mode: 'live', status: 'ok', fetchedAt: now, refreshIntervalMs: 15_000,
    staleAfterMs: 30_000, aircraft: [aircraft()], ...overrides,
  };
}

void test('source timestamp, not receipt time, anchors initial and subsequent prediction', () => {
  const track = createTrack(aircraft(), now);
  assert.equal(track.snapshotAt, now - 5_000);
  assert.deepEqual(track.pose, deadReckon(aircraft(), 5));
  const pose = advanceTrack(track, now + 30_000);
  const expected = destinationPoint(45.5, -73.9, 90, 280 * 1852 / 3600 * 35);
  assert.ok(Math.abs(pose.latitude - expected.latitude) < 1e-9);
  assert.ok(Math.abs(pose.longitude - expected.longitude) < 1e-9);
  applySnapshot(track, aircraft({ lastUpdated: now + 20_000 }), now + 40_000);
  assert.equal(track.snapshotAt, now + 20_000);
  assert.deepEqual(advanceTrack(track, now + 43_000), deadReckon(track.snapshot, 23));
});

void test('extrapolation stops at the named bound even with a longer freshness window', () => {
  const track = createTrack(aircraft({ lastUpdated: now }), now);
  const bound = advanceTrack(track, now + MAX_EXTRAPOLATION_MS);
  const far = advanceTrack(track, now + MAX_EXTRAPOLATION_MS * 2);
  assert.deepEqual(far, bound);
  assert.notEqual(bound.longitude, track.snapshot.longitude);
  assert.deepEqual(deadReckon(track.snapshot, 10_000), bound);
});

void test('configured source and feed expiry freeze pose and trail', () => {
  for (const staleFeed of [feed(), feed({ status: 'delayed' }), feed({ fetchedAt: now - 40_000 })]) {
    const track = createTrack(aircraft(), now);
    advanceTrack(track, now + 10_000, feed({ staleAfterMs: 60_000 }));
    const frozen = track.pose;
    const trail = [...track.trail];
    assert.equal(advanceTrack(track, now + 30_000, staleFeed), frozen);
    assert.equal(track.stale, true);
    assert.equal(advanceTrack(track, now + 80_000, staleFeed), frozen);
    assert.deepEqual(track.trail, trail);
  }
  const old = createTrack(aircraft({ lastUpdated: now - 40_000 }), now, feed());
  assert.equal(old.stale, true);
  assert.equal(old.pose.longitude, old.snapshot.longitude);
});

void test('changed snapshots during an outage preserve the displayed pose and trail', () => {
  const track = createTrack(aircraft(), now, feed());
  advanceTrack(track, now + 10_000, feed());
  const frozen = track.pose;
  const trail = [...track.trail];
  const delayed = feed({ status: 'delayed' });
  applySnapshot(track, aircraft({ longitude: -73.8, lastUpdated: now + 10_000 }), now + 11_000, delayed);
  assert.equal(track.pose, frozen);
  assert.equal(advanceTrack(track, now + 12_000, delayed), frozen);
  assert.deepEqual(track.trail, trail);
  assert.equal(track.stale, true);
  assert.deepEqual(advanceTrack(track, now + 13_000, feed()), frozen);
  assert.equal(track.stale, false);
});

void test('fresh update recovers a stale track with a smooth blend', () => {
  const track = createTrack(aircraft({ lastUpdated: now - 60_000 }), now, feed());
  assert.equal(track.stale, true);
  const before = track.pose;
  applySnapshot(track, aircraft({ latitude: 45.52, longitude: -73.85, lastUpdated: now }), now, feed());
  assert.equal(track.stale, false);
  assert.deepEqual(advanceTrack(track, now, feed()), before);
  advanceTrack(track, now + 2_500, feed());
  assert.equal(track.blendFrom, undefined);
  assert.notEqual(track.pose.longitude, before.longitude);
});

void test('feed recovery with unchanged source does not reset source age', () => {
  const track = createTrack(aircraft(), now, feed({ status: 'delayed' }));
  assert.equal(track.stale, true);
  const before = track.pose;
  assert.deepEqual(advanceTrack(track, now + 1_000, feed()), before);
  assert.equal(track.stale, false);
  assert.deepEqual(advanceTrack(track, now + 4_000, feed()), deadReckon(aircraft(), 9));
});

void test('malformed timestamps fail closed without producing non-finite poses', () => {
  for (const value of [NaN, Infinity, undefined, null, 'bad', now + 60_000, 0, -5]) {
    assert.equal(timestampAgeMs(value, now), Infinity);
    const track = createTrack(aircraft({ lastUpdated: value as number }), now);
    assert.equal(track.stale, true);
    assert.equal(track.pose.longitude, track.snapshot.longitude);
    assert.ok(Object.values(track.pose).filter((v) => typeof v === 'number').every(Number.isFinite));
    assert.equal(isFeedStale(feed({ fetchedAt: value as number }), now), true);
  }
  assert.equal(timestampAgeMs(now + 5_000, now), 0);
  assert.equal(isAircraftStale(aircraft(), NaN, now), false);
});

void test('descending prediction and malformed kinematics never create negative altitude', () => {
  assert.equal(deadReckon(aircraft({ altitudeFt: 200, verticalSpeedFpm: -6_000 }), 60).altitudeFt, 0);
  assert.equal(createTrack(aircraft({ altitudeFt: -100 }), now).pose.altitudeFt, 0);
  const pose = deadReckon(aircraft({ altitudeFt: NaN, groundSpeedKt: Infinity, verticalSpeedFpm: NaN }), NaN);
  assert.equal(pose.altitudeFt, 0);
  assert.equal(pose.longitude, -73.9);
});

void test('repeated cached responses preserve source age and older snapshots cannot rewind it', () => {
  const tracks = new Map();
  const fresh = aircraft({ lastUpdated: now });
  syncTracks(tracks, [fresh], now);
  syncTracks(tracks, [{ ...fresh }], now + 10_000);
  const track = tracks.get(fresh.id)!;
  assert.equal(track.snapshotAt, now);
  syncTracks(tracks, [aircraft({ lastUpdated: now - 10_000, longitude: -80 })], now + 20_000);
  assert.equal(track.snapshotAt, now);
  assert.equal(track.snapshot.longitude, fresh.longitude);
  syncTracks(tracks, [{ ...fresh, groundSpeedKt: 300 }], now + 20_000);
  assert.equal(track.snapshot.groundSpeedKt, 300);
});

void test('arrival notices require both fresh feed and fresh source; recovery restores eligibility', () => {
  const arrival = aircraft({ eta: '2026-09-16T18:20:00Z', sta: '2026-09-16T18:08:00Z' });
  const notices = (payload: LiveFlightsResponse) => arrivalAlerts(freshArrivalAircraft(payload, now), now);
  const good = feed({ aircraft: [arrival] });
  assert.equal(notices(good).length, 1);
  for (const bad of [
    { ...good, status: 'delayed' as const },
    { ...good, status: 'error' as const },
    { ...good, fetchedAt: now - 30_000 },
    { ...good, aircraft: [{ ...arrival, lastUpdated: now - 30_000 }] },
    { ...good, aircraft: [{ ...arrival, lastUpdated: NaN }] },
  ]) assert.equal(notices(bad).length, 0);
  assert.equal(notices(good).length, 1);
  assert.equal(isAircraftStale({ lastUpdated: now - 30_000 }, 30_000, now), true);
  assert.equal(isAircraftStale({ lastUpdated: now - 29_999 }, 30_000, now), false);
});
