import type { GPXPoint } from '../types';

export const SAMPLE_ROUTES = {
  oregon: [
    { lat: 45.68, lng: -121.58, ele: 150, dist: 0.0 },
    { lat: 45.69, lng: -121.55, ele: 195, dist: 2.5 },
    { lat: 45.7049, lng: -121.5263, ele: 240, dist: 4.8 },
    { lat: 45.72, lng: -121.50, ele: 320, dist: 7.2 },
    { lat: 45.74, lng: -121.46, ele: 410, dist: 11.0 }
  ] as GPXPoint[],
  dolomites: [
    { lat: 46.52, lng: 12.10, ele: 1200, dist: 0.0 },
    { lat: 46.5383, lng: 12.1373, ele: 1750, dist: 4.2 },
    { lat: 46.55, lng: 12.17, ele: 2236, dist: 8.5 },
    { lat: 46.57, lng: 12.20, ele: 1980, dist: 12.0 }
  ] as GPXPoint[],
  moab: [
    { lat: 38.54, lng: -109.58, ele: 1250, dist: 0.0 },
    { lat: 38.56, lng: -109.56, ele: 1310, dist: 3.1 },
    { lat: 38.5733, lng: -109.5498, ele: 1390, dist: 5.4 },
    { lat: 38.59, lng: -109.53, ele: 1420, dist: 8.0 },
    { lat: 38.61, lng: -109.50, ele: 1350, dist: 12.5 }
  ] as GPXPoint[]
};
