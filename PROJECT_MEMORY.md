# Project Memory: Bikepack Boarding MVP

This document serves as a persistent state of the development phase, business logic decisions, resolved errors, and the future roadmap for the **Bikepack Boarding** platform.

---

## 1. Project Overview & Business Model
* **Concept**: A bike-friendly accommodation matchmaking platform ("Airbnb for Bikepackers").
* **Key Differentiator**: Solves critical problems for long-distance gravel/road cyclists by filtering hosts who provide secure indoor storage, professional toolkits (e.g., Park Tool), drivetrain wash stations, high-carb breakfast fuel (1000+ kcal), and wet-weather laundry.
* **Target Audience**: High-end gravel and touring cyclists in English-speaking markets (US, Europe, UK).
* **Monetization Roadmap**:
  * **Phase 1 (MVP)**: Zero fees to build initial density.
  * **Phase 2 (SaaS/Sublicense)**: Transaction fee model (3-5% from host, 5-10% from guest) or Host subscription SaaS ($19-$49/month for booking calendars & badge visibility).

---

## 2. Current Accomplishments (What We Have Done)

### A. Environment Configuration
* **Tech Stack**: React 19 + Vite + TypeScript (TSX) + Vanilla CSS.
* **Local Server Port**: Configured to run on **`3011`** (`http://localhost:3011`).

### B. High-Fidelity UI/UX & Layout
* **2-Column Split Screen**: Implemented Airbnb's split view. Left side holds reactive search parameters, GPX simulators, and stay grids. Right side hosts the interactive staying map.
* **Active Outdoor Theme**: Dark theme design using a Gravel Black base (`#0a0a0c`) and Neon Lime Green accents (`#a3e635`) for an athletic, premium aesthetic.
* **Micro-Animations**: Hover animations on stay cards, glow borders on active chips, and smooth modal slide-ups.
* **Image Gallery Carousel**: Implemented arrow buttons and indicator dots inside each stay card to slide through multiple HD Unsplash images.

### C. Advanced Bikepacking SaaS Features
* **Bikepack Infrastructure Filter**: Stays can be dynamically filtered by wash station availability, spares inventory, laundry, price caps, and secure storage types.
* **GPX XML Parsing Engine & Haversine Proximity Filter**: Implemented real-world XML `.gpx` file reading and parsing using the browser's native `DOMParser`. Calculates the exact minimum distance in kilometers from stays to the uploaded GPX route coordinates using the **Haversine formula**. Automatically filters stays to only show options within a 5km radius of the gravel route.
* **Pre-Baked Sample Routes**: Enabled quick one-click testing by providing preset sample routes (Columbia Gorge in Oregon, Passo Giau in the Dolomites, and Slickrock Loop in Moab) that instantly load routes, zoom bounds, and filter accommodations dynamically.
* **Interactive SVG Vector Map**: (Upgraded to Leaflet Map) Places custom stay pin badges containing prices. Hovering on a pin highlights the corresponding list card, and clicking the pin opens the stay details modal.
* **Double-Tab Detail Modal**: The stay detail view is split into "Stay Overview" and "Bikepacking Gear & Mechanics" tabs to display Host toolkits and storage specifications clearly.
* **Booking & Host Mock Engines**: Simulated booking request forms and host stay listing forms that persist changes directly to the browser's `localStorage`.
* **Real-world Map Integration (Leaflet)**: Replaced the static SVG map with a live Leaflet map styled with CartoDB Dark Matter tiles (matching the gravel theme). Features custom lime green HTML pin overlays showing price per night, interactive hover synchronizations with lodging cards, and auto-bounding `fitBounds` adjustments.
* **GPX Route Proximity Overlay**: Draws active routing paths (using actual parsed coordinates from uploaded or sample GPX files) dynamically on the map as an animated dashed line.
* **Database & Auth Integration (Supabase)**: Integrated Supabase client SDK. Added a user signup/login panel supporting email and password authentication, and bound stay listings and bookings to relational Supabase tables.
* **Smart Data Syncing & Seeding**: Implemented table mapping adapters between camelCase JS properties and snake_case DB columns. Features auto-seeding on fresh database connects (inserts initial mock data if stays are empty) and automatic fallback to `localStorage` mode when credentials are missing.

### D. Advanced Real-time & Geolocation Features
* **Address/Geocoding Navigation**: Integrated Nominatim OpenStreetMap API to allow users to search for start and end points via text. Added a **`Use My GPS`** button utilizing the browser's Geolocation API to set current coordinates as the route start point for 100% free GPS search.
* **Real-time Group Tracker & Dropout Alerting**: Added a sidebar group tracking module. Users can set nicknames, create a lobby (generating unique `RIDE-XXXX` codes), or join via code. Leverages **Supabase Realtime Broadcast** (WebSockets memory routing) to avoid database read/write limits and run 100% free.
* **3-tier Dropout Alerts**: Recalculates distance between riders on the fly using Haversine formula and flags statuses as:
  * `Normal`: Within 200m.
  * `Distant` (Yellow Alert): More than 200m away.
  * `Lost` (Red Alert): More than 500m away (spawns map pulse indicator).
* **Premium Toast Notification**: Replaced browser standard `alert()` popups with a beautiful gravel-dark floating toast alert system for premium UI/UX feedback.
* **Supabase Client Safe Proxy**: Wrapped the Supabase client inside a Safe Proxy pattern so that when `.env` is unconfigured, the app falls back gracefully to Mock Local Storage mode instead of crashing or polluting the console.
* **Vitest Suite**: Installed `vitest` and added automated test assertions inside [geo.test.ts](file:///D:/%EC%95%88%ED%8B%B0%EA%B7%B8%EB%9E%98%EB%B9%84%ED%8B%B0%20CLI/bikepack-boarding/src/utils/geo.test.ts) to verify GPS coordinate mathematics.

---

## 3. Solved Engineering Issues
1. **Type-Only Import Warnings (`TS1484`)**:
   * *Issue*: TypeScript compilations failed under the strict `verbatimModuleSyntax` configuration.
   * *Fix*: Converted standard imports of `Lodging`, `Booking`, and `BikepackSpecs` into `import type` declarations in both `App.tsx` and `lodgings.ts`.
2. **LocalStorage Schema Schema Mismatch**:
   * *Issue*: Older sessions had single `imageUrl` strings in localStorage, throwing runtime errors when calling array methods on the new `imageUrls` property.
   * *Fix*: Applied fallback defensive checks (`lodging.imageUrls || [lodging.imageUrl]`) across all components (cards, booking history, and modal overlays).
3. **Supabase "Failed to fetch" Auth Error (Host Domain Unresolved)**:
   * *Issue*: Users faced `Failed to fetch` network failures during sign-up/sign-in due to an invalid project host URL (`hgytnajeirrkspfzxrjo.supabase.co`).
   * *Fix*: Located the actual active Supabase project reference ID (**`qvezomdstiudvbkuawlg`**) and configured it with `sb_publishable_DPseX8KCpm9foxQjpTEJjQ_gQd20TAW` in both `.env` and Vercel dashboard. Triggered **Redeploy** to apply changes.

---

## 4. Next Steps for SaaS Escalation
1. **Stripe API Payments**: Connect Stripe Connect to enable real booking charges and split commissions automatically between the platform owner and hosts.
2. **Supabase Edge Functions Webhook Setup**: Connect Lemon Squeezy subscription webhooks via API handlers.
