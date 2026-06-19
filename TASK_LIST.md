# TASK LIST: Bikepack Boarding Premium Airbnb UX

## 1. Core Airbnb UX Layout
- [x] Implement 2-Column Split Layout → verify: Left pane has filters + listings grid, Right pane houses interactive Dark Map
- [x] Multi-Image Carousel for Lodging Cards → verify: Smooth hover/click arrows to swap between Unsplash outdoor images

## 2. Advanced Bikepacking SaaS Features
- [x] GPX Course Upload Simulator → verify: Upload box accepts dummy/real GPX files and filters stays within proximity (simulated 5km radius)
- [x] Host Specs Detail Tab System → verify: Modal divides "Stay Details" and "Bike Mechanics & Tools" tabs
- [x] Interactive Location Pin Board → verify: Vector map pins match filter statuses and toggle selected lodging on click

## 3. Aesthetics & Micro-Animations
- [x] Modern Premium Dark/Active CSS Polish → verify: Glowing focus rings, glassmorphism filters, smooth slide-in transitions
- [x] Build & Dev Server Run → verify: Compile via `npm run build` and test live on port `3011`

## 4. Real-world Map Integration & GPX Engine (SaaS Escalation Phase 1)
- [x] Replace Custom SVG Vector Map with Leaflet GL/OSM → verify: Sleek dark-themed Leaflet map initializes and renders correctly
- [x] Dynamic Marker Pins with Real Coordinates → verify: Custom lime-colored HTML DivIcons positioned at stays' coordinates and reactive to card hover
- [x] Real GPX XML Parsing Engine (DOMParser) → verify: Reading uploaded `.gpx` tracks, parsing coordinate sequences, and rendering actual route geometry
- [x] Proximity Haversine Distance Filters → verify: Filter stays dynamically based on real distance to GPX route points (<5km)
- [x] Pre-baked Sample Routes for Testing → verify: Links to load Oregon, Dolomites, or Moab paths instantly

## 5. Database & Authentication Integration (SaaS Escalation Phase 2)
- [x] Configure Supabase Client SDK → verify: `supabaseClient.ts` initializes using Vite environment variables
- [x] Robust Database Table Schema → verify: `supabase_schema.sql` creates lodgings and bookings tables with RLS policies
- [x] Dual Local/DB Syncing Architecture → verify: Automatic local storage fallback when credentials are empty
- [x] Dynamic Database Seeding on First Launch → verify: Stays automatically seeded from MOCK_LODGINGS when database is blank
- [x] User Email/Password Sign-In/Up UI → verify: Integrated sign-in badges in header, custom dialog modals, and form validations
- [x] Auth-Guarded Transactions → verify: Require signing in when creating new stays or booking basecamps in database mode

## 6. SaaS Production Readiness & Webhook Integration (SaaS Escalation Phase 3)
- [x] PWA Integration → verify: `manifest.json` and `sw.js` linked for mobile installation support
- [x] Host Subscribed Billing Portal → verify: Manage Billing redirect button active on host tier active view
- [x] Custom Spares & Fuel Menus → verify: Accessibility parameters and nutrition/mechanic data cards display properly on stays
- [ ] Supabase Edge Functions Webhook Setup → verify: Deploy `lemon-squeezy-webhook` function and register URL in dashboard
- [x] Production Environment Var Switch → verify: Resolved URL mismatch using correct Reference ID (qvezomdstiudvbkuawlg) and verified Vercel deploy.

