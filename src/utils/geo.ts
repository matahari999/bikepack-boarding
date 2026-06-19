import type { GPXPoint } from '../types';

// Haversine formula to calculate distance between two coordinates in km
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * d;
}

// Find the minimum distance from lodging coordinates to any track point on the GPX path
export function getMinDistanceToRoute(stayCoords: { lat: number; lng: number }, routePoints: GPXPoint[]): number {
  if (routePoints.length === 0) return Infinity;
  let min = Infinity;
  for (const pt of routePoints) {
    const dist = calculateHaversineDistance(stayCoords.lat, stayCoords.lng, pt.lat, pt.lng);
    if (dist < min) {
      min = dist;
    }
  }
  return min;
}

// Find cumulative distance (km) on the GPX path where the lodging is closest
export function getLodgingDistanceOnRoute(stayCoords: { lat: number; lng: number }, routePoints: GPXPoint[]): number {
  if (routePoints.length === 0) return 0;
  let min = Infinity;
  let bestPoint = routePoints[0];
  for (const pt of routePoints) {
    const dist = calculateHaversineDistance(stayCoords.lat, stayCoords.lng, pt.lat, pt.lng);
    if (dist < min) {
      min = dist;
      bestPoint = pt;
    }
  }
  return bestPoint.dist;
}
