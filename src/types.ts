export interface BikepackSpecs {
  storageType: 'Indoor Garage' | 'Locked Shed' | 'In-Room Rack' | 'Secure Covered Patio';
  toolKitBrand: string; // e.g., "Park Tool Professional Kit", "Topeak PrepStation"
  hasWashStation: boolean;
  hasLaundry: boolean;
  breakfastCalories: number; // e.g., 800-1200 kcal high-carb meal
  hasSparesInventory: boolean; // Has basic inner tubes, chains, patch kits for purchase
  rideInOut: 'Easy Gravel' | 'Steep Asphalt Climb' | 'Singletrack Trail' | 'Highway Shoulder';
  accessNotes?: string;
  sparesList?: string[];
  fuelMenuName?: string;
  fuelMenuDescription?: string;
}

export interface Lodging {
  id: string;
  name: string;
  hostName: string;
  hostAvatarUrl: string;
  region: string;
  country: string;
  pricePerNight: number;
  rating: number;
  reviewsCount: number;
  description: string;
  imageUrls: string[];
  amenities: string[]; // standard amenities: "Wifi", "Hot Shower", "Kitchen", etc.
  bikepackSpecs: BikepackSpecs;
  maxBikes: number;
  coordinates: { lat: number; lng: number };
}

export interface Booking {
  id: string;
  lodgingId: string;
  lodgingName: string;
  lodgingImage: string;
  checkIn: string;
  checkOut: string;
  numBikes: number;
  totalPrice: number;
  status: 'confirmed' | 'pending' | 'completed';
}

export interface GPXPoint {
  lat: number;
  lng: number;
  ele: number;
  dist: number;
}

