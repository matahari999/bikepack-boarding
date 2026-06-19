import type { Lodging } from '../types';

export const MOCK_LODGINGS: Lodging[] = [
  {
    id: 'lodging-1',
    name: 'The Gravel Haven & Gear Shed',
    hostName: 'Marcus Vance',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    region: 'Hood River, Oregon',
    country: 'United States',
    pricePerNight: 145,
    rating: 4.95,
    reviewsCount: 124,
    description: 'A dedicated gravel rider’s paradise nestled in Hood River. Guests get full access to a heated garage featuring a custom wall rack, professional wheel truing stand, and a high-carb espresso bar to fuel your morning ascents.',
    imageUrls: [
      'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&h=500&q=80'
    ],
    amenities: ['High-speed Wifi', 'Hot Tub', 'Outdoor Grill', 'Espresso Machine', 'Dryer'],
    bikepackSpecs: {
      storageType: 'Indoor Garage',
      toolKitBrand: 'Park Tool Professional Kit PK-5',
      hasWashStation: true,
      hasLaundry: true,
      breakfastCalories: 1200,
      hasSparesInventory: true,
      rideInOut: 'Easy Gravel',
      accessNotes: 'Direct, flat gravel road leading right into the backyard gear shed.',
      sparesList: ['700x38c Tubeless Tires', 'Presta Inner Tubes', 'Wet/Dry Chain Lube', 'Tire Patches'],
      fuelMenuName: 'Marcus Peak-Performance Oats',
      fuelMenuDescription: 'Double-portion steel-cut oats topped with raw Hood River honey, chia seeds, sliced bananas, peanut butter, and unlimited espresso.'
    },
    maxBikes: 6,
    coordinates: { lat: 45.7049, lng: -121.5263 }
  },
  {
    id: 'lodging-2',
    name: 'Dolomite Ridge Basecamp',
    hostName: 'Elena Rossi',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80',
    region: 'Cortina d’Ampezzo, Dolomites',
    country: 'Italy',
    pricePerNight: 180,
    rating: 4.98,
    reviewsCount: 89,
    description: 'Elevated Alpine lodge designed specifically for pass-storming cyclists. Features a secure locked cellar, ultrasonic cleaner for drivetrain deep cleans, and high-protein local breakfasts. Overlooks the legendary Passo Giau.',
    imageUrls: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&h=500&q=80'
    ],
    amenities: ['Mountain View Balcony', 'Wood Sauna', 'Underfloor Heating', 'Smart TV', 'Washing Machine'],
    bikepackSpecs: {
      storageType: 'Locked Shed',
      toolKitBrand: 'Abbey Bike Tools Team Decathlon Kit',
      hasWashStation: true,
      hasLaundry: true,
      breakfastCalories: 1050,
      hasSparesInventory: true,
      rideInOut: 'Steep Asphalt Climb',
      accessNotes: 'Last 2km is a steep 11% paved alpine climb up Passo Giau.',
      sparesList: ['Schwalbe 700x40c Tubes', 'Chain Links 11/12 Speed', 'Disc Brake Pads', 'Drivetrain Degreaser'],
      fuelMenuName: 'Col-Climber Carbon Pasta Buffet',
      fuelMenuDescription: 'Whole-wheat Italian pasta tossed in olive oil and garlic, organic eggs, fresh bresaola, local mountain cheese, and high-carb fruit pie.'
    },
    maxBikes: 8,
    coordinates: { lat: 46.5383, lng: 12.1373 }
  },
  {
    id: 'lodging-3',
    name: 'Slickrock Desert Oasis',
    hostName: 'Wyatt Kincaid',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80',
    region: 'Moab, Utah',
    country: 'United States',
    pricePerNight: 130,
    rating: 4.89,
    reviewsCount: 206,
    description: 'Perfect desert launchpad close to Slickrock and Whole Enchilada trailheads. Our secure indoor bike racks keep your rig safe from the desert elements. The workspace is fully loaded, including tubeless sealant refills and a heavy-duty air compressor.',
    imageUrls: [
      'https://images.unsplash.com/photo-1486915309851-b0cc1f8a0084?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&h=500&q=80'
    ],
    amenities: ['Tesla Charger', 'A/C', 'Ice Bath', 'Fire Pit', 'Bike Stand'],
    bikepackSpecs: {
      storageType: 'In-Room Rack',
      toolKitBrand: 'Pedro’s Master Tool Kit 4.0',
      hasWashStation: true,
      hasLaundry: false,
      breakfastCalories: 950,
      hasSparesInventory: true,
      rideInOut: 'Singletrack Trail',
      accessNotes: 'Requires riding 500m of rocky singletrack trail from the main road.',
      sparesList: ['Tubeless Sealant Orange Seal', '29er MTB Tubes', 'CO2 Cartridges', 'Tubeless Plugs Bacon strips'],
      fuelMenuName: 'Slickrock High-Energy Burritos',
      fuelMenuDescription: 'Three scrambled-egg burritos loaded with black beans, avocado, sweet potatoes, cheese, served alongside freshly pressed orange juice.'
    },
    maxBikes: 4,
    coordinates: { lat: 38.5733, lng: -109.5498 }
  },
  {
    id: 'lodging-4',
    name: 'Chamonix Col-Climber Suite',
    hostName: 'Pierre Dubois',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80',
    region: 'Chamonix-Mont-Blanc',
    country: 'France',
    pricePerNight: 210,
    rating: 4.91,
    reviewsCount: 75,
    description: 'Chic mountain loft with a private secure patio that fits up to 4 gravel or road bikes. Includes high-pressure washing station, industrial dryer for wet gear, and organic high-carb oatmeal buffers included. Right next to the iconic col routes.',
    imageUrls: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&h=500&q=80'
    ],
    amenities: ['Mont Blanc View', 'Fireplace', 'Heated Gear Closet', 'Kitchenette', 'Dryer'],
    bikepackSpecs: {
      storageType: 'Secure Covered Patio',
      toolKitBrand: 'Topeak PrepStation Pro',
      hasWashStation: true,
      hasLaundry: true,
      breakfastCalories: 1100,
      hasSparesInventory: false,
      rideInOut: 'Easy Gravel',
      accessNotes: 'Smooth dirt path access, fully rideable with any tire size.',
      sparesList: ['700x28c/32c Road Tubes', 'Chain Lube Dry', 'Patch Kit'],
      fuelMenuName: 'Alpine Porridge & Muesli Buffet',
      fuelMenuDescription: 'Heavy oat porridge cooked in almond milk with dried cranberries, walnuts, fresh berries, local Alpine honey, and butter croissants.'
    },
    maxBikes: 4,
    coordinates: { lat: 45.9227, lng: 6.8685 }
  },
  {
    id: 'lodging-5',
    name: 'Highland Trail Cabin',
    hostName: 'Fiona MacLeod',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
    region: 'Fort William, Highlands',
    country: 'United Kingdom',
    pricePerNight: 115,
    rating: 4.88,
    reviewsCount: 94,
    description: 'A rugged but cozy cabin strategically located along the West Highland Way. Features a lockable stone outhouse for bike storage, chain lube bar, wet-weather drying room, and legendary hot porridge breakfasts built to withstand Scottish drizzle.',
    imageUrls: [
      'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=800&h=500&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&h=500&q=80'
    ],
    amenities: ['Indoor Fireplace', 'Drying Room', 'Stunning Loch View', 'Scotch Whisky Bar'],
    bikepackSpecs: {
      storageType: 'Locked Shed',
      toolKitBrand: 'Park Tool ADV Tool kit',
      hasWashStation: false,
      hasLaundry: true,
      breakfastCalories: 1300,
      hasSparesInventory: true,
      rideInOut: 'Singletrack Trail',
      accessNotes: 'A technical 1.5km dirt path access. Not suitable for pure road tires.',
      sparesList: ['700x45c Gravel Tubes', 'Gorilla Tape & Cable Ties', 'Wet Chain Lube', 'Chain tool pins'],
      fuelMenuName: 'Fort William Scotch Porridge',
      fuelMenuDescription: 'Traditional salted hot porridge oats cooked with cream, served with dark sugar, sliced bananas, protein powder shake, and dark roast filter coffee.'
    },
    maxBikes: 5,
    coordinates: { lat: 56.8198, lng: -5.1052 }
  }
];
