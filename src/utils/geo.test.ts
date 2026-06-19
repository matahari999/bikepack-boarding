import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, getMinDistanceToRoute } from './geo';
import type { GPXPoint } from '../types';

describe('Geo Utilities', () => {
  describe('calculateHaversineDistance', () => {
    it('should calculate distance between two coordinates correctly', () => {
      // Coordinates for Seoul and Busan
      const seoul = { lat: 37.5665, lng: 126.9780 };
      const busan = { lat: 35.1796, lng: 129.0756 };
      
      const distance = calculateHaversineDistance(seoul.lat, seoul.lng, busan.lat, busan.lng);
      
      // Seoul to Busan is roughly 325km
      expect(distance).toBeGreaterThan(320);
      expect(distance).toBeLessThan(330);
    });

    it('should return 0 for identical coordinates', () => {
      const lat = 37.5665;
      const lng = 126.9780;
      const distance = calculateHaversineDistance(lat, lng, lat, lng);
      expect(distance).toBe(0);
    });
  });

  describe('getMinDistanceToRoute', () => {
    it('should return Infinity if route is empty', () => {
      const stay = { lat: 37.5, lng: 127.0 };
      const route: GPXPoint[] = [];
      const dist = getMinDistanceToRoute(stay, route);
      expect(dist).toBe(Infinity);
    });

    it('should find closest route point distance', () => {
      const stay = { lat: 37.5, lng: 127.0 };
      const route: GPXPoint[] = [
        { lat: 37.1, lng: 126.8, ele: 100, dist: 0 },
        { lat: 37.49, lng: 127.01, ele: 120, dist: 45 }, // Closest point
        { lat: 38.0, lng: 128.0, ele: 150, dist: 90 },
      ];
      
      const dist = getMinDistanceToRoute(stay, route);
      const directDist = calculateHaversineDistance(stay.lat, stay.lng, 37.49, 127.01);
      
      expect(dist).toBe(directDist);
    });
  });
});
