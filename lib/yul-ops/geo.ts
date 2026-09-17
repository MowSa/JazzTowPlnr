import { YUL } from './constants.ts';

const EARTH_RADIUS_M = 6_371_000;
const DEG = Math.PI / 180;

function toRad(deg: number) {
  return deg * DEG;
}

function toDeg(rad: number) {
  return rad / DEG;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_M) / 1000;
}

export function distanceFromYulKm(latitude: number, longitude: number) {
  return haversineKm(latitude, longitude, YUL.latitude, YUL.longitude);
}

export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint(
  lat: number,
  lon: number,
  headingDeg: number,
  distanceM: number,
) {
  if (!Number.isFinite(distanceM) || distanceM === 0) return { latitude: lat, longitude: lon };
  const angular = distanceM / EARTH_RADIUS_M;
  const bearing = toRad(headingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    latitude: toDeg(lat2),
    longitude: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

export function lerpAngleDeg(from: number, to: number, t: number) {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
