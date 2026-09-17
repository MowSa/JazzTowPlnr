import { destinationPoint, lerpAngleDeg } from './geo.ts';
import {
  freshnessWindowMs, isAircraftStale, isFeedStale, MAX_EXTRAPOLATION_MS,
  sourceTimestamp, type FeedFreshnessContext,
} from './freshness.ts';
import type { InterpolatedPose, LiveAircraft } from './types.ts';

const KNOTS_TO_MPS = 1852 / 3600;
const BLEND_MS = 2500;

export type TrackSample = {
  longitude: number;
  latitude: number;
  altitudeFt: number;
};

export type AircraftTrack = {
  id: string;
  snapshot: LiveAircraft;
  /** Source position time, never reset merely because a response was received. */
  snapshotAt: number;
  blendFrom?: InterpolatedPose;
  blendUntil: number;
  pose: InterpolatedPose;
  trail: TrackSample[];
  stale: boolean;
};

function finiteOrZero(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function deadReckon(snapshot: LiveAircraft, dtSec: number): InterpolatedPose {
  const seconds = Number.isFinite(dtSec) ? Math.min(MAX_EXTRAPOLATION_MS / 1000, Math.max(0, dtSec)) : 0;
  const heading = finiteOrZero(snapshot.headingDeg);
  const speedKt = Math.max(0, finiteOrZero(snapshot.groundSpeedKt));
  const vs = finiteOrZero(snapshot.verticalSpeedFpm);
  const originAlt = Math.max(0, finiteOrZero(snapshot.altitudeFt));
  const moved = destinationPoint(snapshot.latitude, snapshot.longitude, heading, speedKt * KNOTS_TO_MPS * seconds);
  return {
    latitude: moved.latitude,
    longitude: moved.longitude,
    altitudeFt: Math.max(0, originAlt + (vs * seconds) / 60),
    headingDeg: heading,
    source: 'interpolated',
  };
}

function lerpPose(from: InterpolatedPose, to: InterpolatedPose, t: number): InterpolatedPose {
  const k = Math.min(1, Math.max(0, t));
  const smooth = k * k * (3 - 2 * k);
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * smooth,
    longitude: from.longitude + (to.longitude - from.longitude) * smooth,
    altitudeFt: Math.max(0, from.altitudeFt + (to.altitudeFt - from.altitudeFt) * smooth),
    headingDeg: lerpAngleDeg(from.headingDeg, to.headingDeg, smooth),
    source: 'interpolated',
  };
}

function staleSnapshot(snapshot: LiveAircraft, now: number, feed?: FeedFreshnessContext) {
  return isAircraftStale(snapshot, feed?.staleAfterMs, now) || Boolean(feed && isFeedStale(feed, now));
}

export function createTrack(snapshot: LiveAircraft, now = Date.now(), feed?: FeedFreshnessContext): AircraftTrack {
  const snapshotAt = sourceTimestamp(snapshot.lastUpdated, now);
  const stale = staleSnapshot(snapshot, now, feed);
  const pose = deadReckon(snapshot, stale || snapshotAt === null ? 0 : (now - snapshotAt) / 1000);
  return {
    id: snapshot.id,
    snapshot,
    snapshotAt: snapshotAt ?? now,
    blendUntil: now,
    pose,
    stale,
    trail: [{ longitude: pose.longitude, latitude: pose.latitude, altitudeFt: pose.altitudeFt }],
  };
}

export function applySnapshot(track: AircraftTrack, snapshot: LiveAircraft, now = Date.now(), feed?: FeedFreshnessContext) {
  const timestamp = sourceTimestamp(snapshot.lastUpdated, now);
  const previousTimestamp = sourceTimestamp(track.snapshot.lastUpdated, now);
  // A delayed response must not overwrite a newer position already on screen.
  if (timestamp !== null && previousTimestamp !== null && timestamp < previousTimestamp) return;
  track.blendFrom = { ...track.pose };
  track.blendUntil = now + BLEND_MS;
  track.snapshot = snapshot;
  track.snapshotAt = timestamp ?? now;
  track.stale = staleSnapshot(snapshot, now, feed);
  if (track.stale) {
    // Retain the displayed pose, even when a delayed response changes fields.
    // The new source sample is only used for movement once freshness recovers.
    track.blendFrom = undefined;
  }
}

export function advanceTrack(track: AircraftTrack, now = Date.now(), feed?: FeedFreshnessContext) {
  const stale = staleSnapshot(track.snapshot, now, feed);
  // Keep the last displayed pose when a feed fails or its timestamp expires.
  if (stale) {
    track.stale = true;
    track.blendFrom = undefined;
    return track.pose;
  }
  // A recovered feed may still contain the same position: resume smoothly.
  if (track.stale) {
    track.blendFrom = { ...track.pose };
    track.blendUntil = now + BLEND_MS;
  }
  track.stale = false;
  const ageMs = Math.min(Math.max(0, now - track.snapshotAt), freshnessWindowMs(feed?.staleAfterMs));
  const predicted = deadReckon(track.snapshot, ageMs / 1000);
  if (track.blendFrom && now < track.blendUntil) {
    const t = 1 - (track.blendUntil - now) / BLEND_MS;
    track.pose = lerpPose(track.blendFrom, predicted, t);
  } else {
    track.pose = predicted;
    track.blendFrom = undefined;
  }
  const last = track.trail[track.trail.length - 1];
  const moved = !last || Math.abs(last.latitude - track.pose.latitude) > 0.002 || Math.abs(last.longitude - track.pose.longitude) > 0.002;
  if (moved) {
    track.trail.push({ longitude: track.pose.longitude, latitude: track.pose.latitude, altitudeFt: track.pose.altitudeFt });
    if (track.trail.length > 72) track.trail.splice(0, track.trail.length - 72);
  }
  return track.pose;
}

function snapshotChanged(previous: LiveAircraft, next: LiveAircraft) {
  return (
    !Object.is(previous.lastUpdated, next.lastUpdated) ||
    previous.latitude !== next.latitude || previous.longitude !== next.longitude ||
    previous.altitudeFt !== next.altitudeFt || previous.headingDeg !== next.headingDeg ||
    previous.groundSpeedKt !== next.groundSpeedKt || previous.verticalSpeedFpm !== next.verticalSpeedFpm
  );
}

export function syncTracks(tracks: Map<string, AircraftTrack>, snapshots: LiveAircraft[], now = Date.now(), feed?: FeedFreshnessContext) {
  const seen = new Set<string>();
  for (const snapshot of snapshots) {
    seen.add(snapshot.id);
    const existing = tracks.get(snapshot.id);
    if (!existing) tracks.set(snapshot.id, createTrack(snapshot, now, feed));
    else if (snapshotChanged(existing.snapshot, snapshot)) applySnapshot(existing, snapshot, now, feed);
    else existing.snapshot = snapshot;
  }
  for (const id of tracks.keys()) {
    if (!seen.has(id)) tracks.delete(id);
  }
}
