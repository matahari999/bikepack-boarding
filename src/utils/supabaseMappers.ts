import type { Lodging } from '../types';

// DB mapper functions to translate between snake_case DB columns and camelCase JS types
export const mapDbToLodging = (db: any): Lodging => ({
  id: db.id,
  name: db.name,
  hostName: db.host_name,
  hostAvatarUrl: db.host_avatar_url,
  region: db.region,
  country: db.country,
  pricePerNight: db.price_per_night,
  rating: parseFloat(db.rating),
  reviewsCount: db.reviews_count,
  description: db.description,
  imageUrls: Array.isArray(db.image_urls) ? db.image_urls : JSON.parse(db.image_urls || '[]'),
  amenities: Array.isArray(db.amenities) ? db.amenities : JSON.parse(db.amenities || '[]'),
  bikepackSpecs: typeof db.bikepack_specs === 'string' ? JSON.parse(db.bikepack_specs) : db.bikepack_specs,
  maxBikes: db.max_bikes,
  coordinates: typeof db.coordinates === 'string' ? JSON.parse(db.coordinates) : db.coordinates,
});

export const mapLodgingToDb = (l: Lodging) => ({
  id: l.id,
  name: l.name,
  host_name: l.hostName,
  host_avatar_url: l.hostAvatarUrl,
  region: l.region,
  country: l.country,
  price_per_night: l.pricePerNight,
  rating: l.rating,
  reviews_count: l.reviewsCount,
  description: l.description,
  image_urls: l.imageUrls,
  amenities: l.amenities,
  bikepack_specs: l.bikepackSpecs,
  max_bikes: l.maxBikes,
  coordinates: l.coordinates
});
