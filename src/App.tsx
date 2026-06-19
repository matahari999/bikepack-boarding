import { useState, useEffect, useRef } from 'react';
import { MOCK_LODGINGS } from './data/lodgings';
import type { Lodging, Booking, BikepackSpecs, GPXPoint } from './types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

// Imported modular components and utility helpers
import LodgingCard from './components/LodgingCard';
import ElevationProfile from './components/ElevationProfile';
import { SAMPLE_ROUTES } from './data/routes';
import { calculateHaversineDistance, getMinDistanceToRoute, getLodgingDistanceOnRoute } from './utils/geo';
import { mapDbToLodging, mapLodgingToDb } from './utils/supabaseMappers';

const getImageUrls = (lodging: Lodging): string[] =>
  lodging.imageUrls || ((lodging as any).imageUrl ? [(lodging as any).imageUrl] : []);

function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'listings' | 'bookings' | 'host'>('listings');

  // User Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Status flags for Supabase
  const [dbLoading, setDbLoading] = useState(isSupabaseConfigured);

  // Listings & Bookings State
  const [listings, setListings] = useState<Lodging[]>(() => {
    const saved = localStorage.getItem('bikepack_listings');
    return saved ? JSON.parse(saved) : MOCK_LODGINGS;
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('bikepack_bookings');
    return saved ? JSON.parse(saved) : [];
  });

  // Premium Toast Notification State
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, visible: true });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };


  // Group join toggle state
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinInputCode, setJoinInputCode] = useState('');

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch lodgings from Supabase and seed if empty
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const fetchLodgings = async () => {
      try {
        setDbLoading(true);
        const { data, error } = await supabase.from('lodgings').select('*');
        if (error) throw error;

        if (!data || data.length === 0) {
          // Seed the database with mock stays
          for (const lodging of MOCK_LODGINGS) {
            await supabase.from('lodgings').insert(mapLodgingToDb(lodging));
          }
          setListings(MOCK_LODGINGS);
        } else {
          setListings(data.map(mapDbToLodging));
        }
      } catch (err) {
        console.error('Error fetching lodgings from Supabase', err);
      } finally {
        setDbLoading(false);
      }
    };

    fetchLodgings();
  }, []);

  // Fetch user's bookings from Supabase when user logs in
  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      const saved = localStorage.getItem('bikepack_bookings');
      setBookings(saved ? JSON.parse(saved) : []);
      return;
    }

    const fetchBookings = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', user.id);
        
        if (error) throw error;

        if (data) {
          const mappedBookings = data.map((b: any) => ({
            id: b.id,
            lodgingId: b.lodging_id,
            lodgingName: b.lodging_name,
            lodgingImage: b.lodging_image,
            checkIn: b.check_in,
            checkOut: b.check_out,
            numBikes: b.num_bikes,
            totalPrice: b.total_price,
            status: b.status,
          }));
          setBookings(mappedBookings);
        }
      } catch (err) {
        console.error('Error fetching bookings from Supabase', err);
      }
    };

    fetchBookings();
  }, [user]);

  // Keep localStorage sync only when Supabase is NOT configured
  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem('bikepack_listings', JSON.stringify(listings));
      localStorage.setItem('bikepack_bookings', JSON.stringify(bookings));
    }
  }, [listings, bookings]);

  // Check subscription status
  const isSubscribed = () => {
    if (!isSupabaseConfigured) {
      return localStorage.getItem('bikepack_local_subscribed') === 'true';
    }
    return user?.user_metadata?.is_subscribed === true;
  };

  // Core subscription activation logic (unifies real success & test bypass)
  const activateSubscription = async (isTestMode = false) => {
    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase.auth.updateUser({
          data: { is_subscribed: true }
        });
        if (error) throw error;
        
        // Refresh session
        const { data: { session } } = await supabase.auth.refreshSession();
        setUser(session?.user ?? null);
        
        if (isTestMode) {
          showToast('Subscription bypassed successfully (Test Mode)!');
        } else {
          showToast('Subscription activated! Thank you for hosting the gravel community.');
        }
      } catch (err: any) {
        console.error('Error updating user metadata in Supabase:', err);
        showToast(`Failed to activate subscription: ${err.message}`);
      }
    } else {
      localStorage.setItem('bikepack_local_subscribed', 'true');
      if (isTestMode) {
        showToast('Subscription bypassed locally (Test Mode)!');
      } else {
        showToast('Subscription activated (local storage fallback)!');
      }
      window.location.reload();
    }
  };

  const handleSubscriptionSuccess = () => activateSubscription(false);
  const handleBypassSubscription = () => activateSubscription(true);

  // Test Reset: return to free tier
  const handleResetSubscription = async () => {
    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase.auth.updateUser({
          data: { is_subscribed: false }
        });
        if (error) throw error;
        
        const { data: { session } } = await supabase.auth.refreshSession();
        setUser(session?.user ?? null);
        showToast('Subscription reset to free tier.');
      } catch (err: any) {
        showToast(err.message);
      }
    } else {
      localStorage.removeItem('bikepack_local_subscribed');
      showToast('Subscription reset locally.');
      window.location.reload();
    }
  };

  // Initialize Lemon Squeezy JS Overlay script on mount
  useEffect(() => {
    const initLemonSqueezy = () => {
      if ((window as any).LemonSqueezy) {
        (window as any).LemonSqueezy.Setup({
          eventHandler: (eventData: any) => {
            console.log('Lemon Squeezy Event:', eventData);
            if (eventData.event === 'Checkout.Success') {
              handleSubscriptionSuccess();
            }
          }
        });
      }
    };

    initLemonSqueezy();
    const timer = setTimeout(initLemonSqueezy, 1000);
    return () => clearTimeout(timer);
  }, [user]);

  // Filter States
  const [searchRegion, setSearchRegion] = useState<string>('All');
  const [maxPrice, setMaxPrice] = useState<number>(250);
  const [storageFilter, setStorageFilter] = useState<string>('All');
  const [minCalories, setMinCalories] = useState<number>(0);
  const [requireWash, setRequireWash] = useState<boolean>(false);
  const [requireSpares, setRequireSpares] = useState<boolean>(false);
  const [requireLaundry, setRequireLaundry] = useState<boolean>(false);
  const [rideInOutFilter, setRideInOutFilter] = useState<string>('All');

  // GPX File Upload Simulation State
  const [gpxFileName, setGpxFileName] = useState<string | null>(null);
  const [gpxFilterActive, setGpxFilterActive] = useState<boolean>(false);
  const [gpxRoutePoints, setGpxRoutePoints] = useState<GPXPoint[]>([]);
  const [hoveredGpxPoint, setHoveredGpxPoint] = useState<GPXPoint | null>(null);

  // Hover & Highlight Sync
  const [hoveredLodgingId, setHoveredLodgingId] = useState<string | null>(null);

  // Detail Modal State & Sub-Tab inside Modal
  const [selectedLodging, setSelectedLodging] = useState<Lodging | null>(null);
  const [modalSubTab, setModalSubTab] = useState<'overview' | 'mechanics'>('overview');

  // Booking Form State
  const [bookingCheckIn, setBookingCheckIn] = useState<string>('');
  const [bookingCheckOut, setBookingCheckOut] = useState<string>('');
  const [bookingBikes, setBookingBikes] = useState<number>(1);

  // Host Registration Form State
  const [newLodgingName, setNewLodgingName] = useState('');
  const [newHostName, setNewHostName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newCountry, setNewCountry] = useState('United States');
  const [newPrice, setNewPrice] = useState<number>(100);
  const [newDescription, setNewDescription] = useState('');
  const [newImageUrl1, setNewImageUrl1] = useState('');
  const [newImageUrl2, setNewImageUrl2] = useState('');
  const [newMaxBikes, setNewMaxBikes] = useState<number>(4);
  const [newStorageType, setNewStorageType] = useState<BikepackSpecs['storageType']>('Indoor Garage');
  const [newToolBrand, setNewToolBrand] = useState('Park Tool Kit');
  const [newHasWash, setNewHasWash] = useState(false);
  const [newHasLaundry, setNewHasLaundry] = useState(false);
  const [newCalories, setNewCalories] = useState<number>(800);
  const [newHasSpares, setNewHasSpares] = useState(false);
  const [newRideInOut, setNewRideInOut] = useState<BikepackSpecs['rideInOut']>('Easy Gravel');
  const [newAccessNotes, setNewAccessNotes] = useState('');
  const [newSparesList, setNewSparesList] = useState('');
  const [newFuelMenuName, setNewFuelMenuName] = useState('');
  const [newFuelMenuDescription, setNewFuelMenuDescription] = useState('');

  // Leaflet Map state & references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [markersGroup, setMarkersGroup] = useState<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Bikepacking Route Finder (Start/End Navigation) State
  const [isRoutingMode, setIsRoutingMode] = useState<boolean>(false);
  const [routingStart, setRoutingStart] = useState<L.LatLngTuple | null>(null);
  const [routingEnd, setRoutingEnd] = useState<L.LatLngTuple | null>(null);
  const [routingLoading, setRoutingLoading] = useState<boolean>(false);

  // Geocoding Search States for Navigation
  const [startSearchQuery, setStartSearchQuery] = useState('');
  const [endSearchQuery, setEndSearchQuery] = useState('');
  const [startSearchResults, setStartSearchResults] = useState<any[]>([]);
  const [endSearchResults, setEndSearchResults] = useState<any[]>([]);
  const [searchingStart, setSearchingStart] = useState(false);
  const [searchingEnd, setSearchingEnd] = useState(false);

  // Live Group Ride Tracking State
  const [groupRideCode, setGroupRideCode] = useState<string | null>(null);
  const [groupNickname, setGroupNickname] = useState<string>(`Rider_${Math.floor(1000 + Math.random() * 9000)}`);
  const [groupMembers, setGroupMembers] = useState<Record<string, { name: string, lat: number, lng: number, lastActive: number, distance: number, status: 'normal' | 'warn' | 'lost' }>>({});
  const [isSharingLocation, setIsSharingLocation] = useState<boolean>(false);
  const [myLocationForGroup, setMyLocationForGroup] = useState<L.LatLngTuple | null>(null);

  // Filter listings
  const filteredListings = listings.filter((lodging) => {
    // GPX proximity check (show stays within 5km of active path)
    if (gpxFilterActive && gpxRoutePoints.length > 0) {
      const dist = getMinDistanceToRoute(lodging.coordinates, gpxRoutePoints);
      if (dist > 5.0) return false;
    }
    // Region/Country filter
    if (searchRegion !== 'All' && lodging.country !== searchRegion && !lodging.region.includes(searchRegion)) {
      return false;
    }
    // Price filter
    if (lodging.pricePerNight > maxPrice) {
      return false;
    }
    // Storage Type filter
    if (storageFilter !== 'All' && lodging.bikepackSpecs.storageType !== storageFilter) {
      return false;
    }
    // Calories filter
    if (lodging.bikepackSpecs.breakfastCalories < minCalories) {
      return false;
    }
    // Amenity checks
    if (requireWash && !lodging.bikepackSpecs.hasWashStation) return false;
    if (requireSpares && !lodging.bikepackSpecs.hasSparesInventory) return false;
    if (requireLaundry && !lodging.bikepackSpecs.hasLaundry) return false;
    
    // Ride-in, Ride-out accessibility filter
    if (rideInOutFilter !== 'All' && lodging.bikepackSpecs.rideInOut !== rideInOutFilter) {
      return false;
    }

    return true;
  });

  // Unique Countries list for filters
  const countries = Array.from(new Set(listings.map((l) => l.country)));

  // Calculate nights for booking widget
  const calculateNights = (inDate: string, outDate: string): number => {
    if (!inDate || !outDate) return 0;
    const start = new Date(inDate);
    const end = new Date(outDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) ? 0 : diffDays;
  };

  const bookingNights = calculateNights(bookingCheckIn, bookingCheckOut);
  const baseBookingTotal = selectedLodging ? selectedLodging.pricePerNight * bookingNights : 0;
  const bookingBikeSurcharge = bookingBikes * 10 * bookingNights; 
  const bookingTotal = baseBookingTotal + bookingBikeSurcharge;

  // Load pre-baked sample routes for instant testing
  const loadSampleRoute = (key: 'oregon' | 'dolomites' | 'moab') => {
    const routeNames = {
      oregon: 'columbia_gorge_gravel.gpx',
      dolomites: 'passo_giau_climb.gpx',
      moab: 'slickrock_loop.gpx'
    };
    setGpxRoutePoints(SAMPLE_ROUTES[key]);
    setGpxFileName(routeNames[key]);
    setGpxFilterActive(true);
  };

  // Handle GPX upload with XML parsing via DOMParser
  const handleGpxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;
        
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml");
          const trkpts = xmlDoc.getElementsByTagName("trkpt");
          
          if (trkpts.length === 0) {
            showToast("No track points found in GPX file.");
            return;
          }
          
          const points: GPXPoint[] = [];
          // Downsample high-density paths to max 1000 points to keep leaflet snappy
          const step = Math.max(1, Math.floor(trkpts.length / 1000));
          
          let accumulatedDistance = 0;
          for (let i = 0; i < trkpts.length; i += step) {
            const lat = parseFloat(trkpts[i].getAttribute("lat") || "0");
            const lon = parseFloat(trkpts[i].getAttribute("lon") || "0");
            
            // Extract elevation <ele>
            const eleEl = trkpts[i].getElementsByTagName("ele")[0];
            const ele = eleEl ? parseFloat(eleEl.textContent || "0") : 0;
            
            if (!isNaN(lat) && !isNaN(lon)) {
              if (points.length > 0) {
                const prev = points[points.length - 1];
                const distDiff = calculateHaversineDistance(prev.lat, prev.lng, lat, lon);
                accumulatedDistance += distDiff;
              }
              
              points.push({
                lat,
                lng: lon,
                ele: isNaN(ele) ? 0 : ele,
                dist: Math.round(accumulatedDistance * 10) / 10
              });
            }
          }
          
          setGpxRoutePoints(points);
          setGpxFileName(file.name);
          setGpxFilterActive(true);
        } catch (err) {
          console.error("Error parsing GPX file", err);
          showToast("Error parsing GPX file. Please verify it is a valid XML GPX format.");
        }
      };
      reader.readAsText(file);
    }
  };

  const clearGpxFilter = () => {
    setGpxFileName(null);
    setGpxFilterActive(false);
    setGpxRoutePoints([]);
  };

  const clearRouteFinder = () => {
    setRoutingStart(null);
    setRoutingEnd(null);
    setIsRoutingMode(false);
    setStartSearchQuery('');
    setEndSearchQuery('');
    setStartSearchResults([]);
    setEndSearchResults([]);
    clearGpxFilter();
  };

  // Search address/location using Nominatim OpenStreetMap API
  const handleSearchLocation = async (query: string, type: 'start' | 'end') => {
    if (!query.trim()) return;
    if (type === 'start') setSearchingStart(true);
    else setSearchingEnd(true);

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BikepackBoarding/1.0'
        }
      });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      if (type === 'start') {
        setStartSearchResults(data);
      } else {
        setEndSearchResults(data);
      }
    } catch (error) {
      console.error('Error searching location:', error);
      showToast('Location search failed. Please try again.');
    } finally {
      if (type === 'start') setSearchingStart(false);
      else setSearchingEnd(false);
    }
  };

  const selectSearchResult = (item: any, type: 'start' | 'end') => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const coords: L.LatLngTuple = [lat, lon];

    if (type === 'start') {
      setRoutingStart(coords);
      setStartSearchQuery(item.display_name);
      setStartSearchResults([]);
    } else {
      setRoutingEnd(coords);
      setEndSearchQuery(item.display_name);
      setEndSearchResults([]);
    }

    if (map) {
      map.setView(coords, 13);
    }
  };

  // GPS geolocation to use current device location as Start point (FREE)
  const useCurrentLocationAsStart = () => {
    if (!navigator.geolocation) {
      showToast("This device or browser does not support GPS geolocation.");
      return;
    }

    setSearchingStart(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const coords: L.LatLngTuple = [lat, lon];

        setRoutingStart(coords);
        setStartSearchQuery("📌 My Current Location");
        setStartSearchResults([]);
        setSearchingStart(false);

        if (map) {
          map.setView(coords, 14);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setSearchingStart(false);
        let msg = "Failed to retrieve GPS location.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission denied. Please allow location access in your browser settings.";
        }
        showToast(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const myClientIdRef = useRef(Math.random().toString(36).substring(2, 10));

  // Periodically send my GPS location to Supabase Realtime channel if sharing is active
  useEffect(() => {
    if (!groupRideCode || !isSharingLocation) return;

    const channel = supabase.channel(groupRideCode);

    const sendMyLocation = () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMyLocationForGroup([lat, lng]);

          // Broadcast coordinates to all peers in the same channel
          channel.send({
            type: 'broadcast',
            event: 'location',
            payload: {
              clientId: myClientIdRef.current,
              name: groupNickname,
              lat,
              lng,
              timestamp: Date.now()
            }
          });
        },
        (error) => {
          console.error("Group tracking geolocation error:", error);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };

    // Send immediately on start
    sendMyLocation();

    // Send location every 5 seconds
    const interval = setInterval(sendMyLocation, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [groupRideCode, isSharingLocation, groupNickname]);

  // Subscribe to group ride channel and receive real-time locations from peers
  useEffect(() => {
    if (!groupRideCode) {
      setGroupMembers({});
      return;
    }

    const channel = supabase.channel(groupRideCode);

    channel
      .on('broadcast', { event: 'location' }, (response: any) => {
        const { clientId, name, lat, lng, timestamp } = response.payload;
        if (clientId === myClientIdRef.current) return; // Skip my own updates

        setGroupMembers((prev) => {
          // Will recalculate distance and status on myLocationForGroup updates
          return {
            ...prev,
            [clientId]: {
              name,
              lat,
              lng,
              lastActive: timestamp,
              distance: 0, // Will recalculate on next update or if myLocationForGroup updates
              status: 'normal'
            }
          };
        });
      })
      .subscribe();

    // Clean up inactive members (no update for 30s) every 10 seconds
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setGroupMembers((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((key) => {
          if (now - next[key].lastActive > 30000) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 10000);

    return () => {
      channel.unsubscribe();
      clearInterval(cleanupInterval);
    };
  }, [groupRideCode]);

  // Update peer distances whenever my location or peer locations update
  useEffect(() => {
    if (!myLocationForGroup || Object.keys(groupMembers).length === 0) return;

    setGroupMembers((prev) => {
      const updated = { ...prev };
      let changed = false;

      Object.keys(updated).forEach((key) => {
        const peer = updated[key];
        const dist = calculateHaversineDistance(myLocationForGroup[0], myLocationForGroup[1], peer.lat, peer.lng) * 1000; // in meters
        const roundedDist = Math.round(dist);
        
        let newStatus: 'normal' | 'warn' | 'lost' = 'normal';
        if (dist > 500) {
          newStatus = 'lost';
        } else if (dist > 200) {
          newStatus = 'warn';
        }

        if (peer.distance !== roundedDist || peer.status !== newStatus) {
          updated[key] = {
            ...peer,
            distance: roundedDist,
            status: newStatus
          };
          changed = true;
        }
      });

      return changed ? updated : prev;
    });
  }, [myLocationForGroup, groupMembers]);

  // Map Click Handler for routing selection
  useEffect(() => {
    if (!map || !isRoutingMode) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (!routingStart) {
        setRoutingStart([lat, lng]);
      } else if (!routingEnd) {
        setRoutingEnd([lat, lng]);
      }
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [map, isRoutingMode, routingStart, routingEnd]);

  // Query OSRM Bicycle Router when Start and End points are set
  useEffect(() => {
    const fetchRoute = async () => {
      if (!routingStart || !routingEnd) return;
      setRoutingLoading(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/bicycle/${routingStart[1]},${routingStart[0]};${routingEnd[1]},${routingEnd[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM routing request failed');
        const data = await res.json();
        
        if (!data.routes || data.routes.length === 0) {
          showToast('Could not calculate a bicycle route between these two locations.');
          setRoutingEnd(null);
          return;
        }

        const routeGeoJson = data.routes[0].geometry;
        const coords = routeGeoJson.coordinates as [number, number][];

        let accumulatedDistance = 0;
        const gpxPoints: GPXPoint[] = coords.map((coord, index) => {
          const lat = coord[1];
          const lng = coord[0];
          
          if (index > 0) {
            const prev = coords[index - 1];
            accumulatedDistance += calculateHaversineDistance(prev[1], prev[0], lat, lng);
          }
          
          // Generate a smooth simulated mountain elevation profile based on route progress
          const baseEle = 200;
          const wave1 = Math.sin((index / coords.length) * Math.PI * 2) * 150;
          const wave2 = Math.sin((index / coords.length) * Math.PI * 8) * 45;
          const simulatedElevation = Math.max(10, Math.round(baseEle + wave1 + wave2));

          return {
            lat,
            lng,
            ele: simulatedElevation,
            dist: Math.round(accumulatedDistance * 10) / 10
          };
        });

        setGpxRoutePoints(gpxPoints);
        setGpxFileName('Custom Bicycle Route');
        setGpxFilterActive(true);
      } catch (err: any) {
        console.error(err);
        showToast('Error fetching route from OSRM Router. Please try again.');
      } finally {
        setRoutingLoading(false);
      }
    };

    fetchRoute();
  }, [routingStart, routingEnd]);

  // Handle authentication form submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Please fill out all fields.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setAuthModalOpen(false);
        setAuthEmail('');
        setAuthPassword('');
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        showToast('Registration successful! Please verify your email or sign in.');
        setAuthModalOpen(false);
        setAuthEmail('');
        setAuthPassword('');
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setUser(null);
    setBookings([]);
    showToast('Logged out successfully.');
  };

  // Handle Book Action
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLodging) return;

    // Auth Guard for Supabase mode
    if (isSupabaseConfigured && !user) {
      setAuthMode('login');
      setAuthModalOpen(true);
      showToast('Please sign in or sign up to book a basecamp.');
      return;
    }

    if (!bookingCheckIn || !bookingCheckOut) {
      showToast('Please select check-in and check-out dates.');
      return;
    }
    if (new Date(bookingCheckIn) >= new Date(bookingCheckOut)) {
      showToast('Check-out must be after check-in.');
      return;
    }
    if (bookingBikes > selectedLodging.maxBikes) {
      showToast(`This host only accommodates up to ${selectedLodging.maxBikes} bikes.`);
      return;
    }

    const bookingImg = getImageUrls(selectedLodging)[0] || 'https://images.unsplash.com/photo-1501555088652-021faa106b9b';
    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      lodgingId: selectedLodging.id,
      lodgingName: selectedLodging.name,
      lodgingImage: bookingImg,
      checkIn: bookingCheckIn,
      checkOut: bookingCheckOut,
      numBikes: bookingBikes,
      totalPrice: bookingTotal,
      status: 'confirmed',
    };

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase.from('bookings').insert({
          id: newBooking.id,
          lodging_id: newBooking.lodgingId,
          lodging_name: newBooking.lodgingName,
          lodging_image: newBooking.lodgingImage,
          check_in: newBooking.checkIn,
          check_out: newBooking.checkOut,
          num_bikes: newBooking.numBikes,
          total_price: newBooking.totalPrice,
          status: newBooking.status,
          user_id: user.id
        });
        if (error) throw error;
        
        setBookings([newBooking, ...bookings]);
        showToast('Booking request confirmed via Supabase DB!');
      } catch (err: any) {
        console.error('Supabase booking error:', err);
        showToast(`Failed to save booking to database: ${err.message}`);
        return;
      }
    } else {
      setBookings([newBooking, ...bookings]);
      showToast('Booking request saved locally!');
    }

    setSelectedLodging(null);
    setBookingCheckIn('');
    setBookingCheckOut('');
    setBookingBikes(1);
    setActiveTab('bookings');
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      if (isSupabaseConfigured && user) {
        try {
          const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', bookingId);
          if (error) throw error;
          
          setBookings(bookings.filter((b) => b.id !== bookingId));
          showToast('Booking cancelled successfully.');
        } catch (err: any) {
          console.error('Supabase cancel booking error:', err);
          showToast(`Failed to cancel booking: ${err.message}`);
        }
      } else {
        setBookings(bookings.filter((b) => b.id !== bookingId));
        showToast('Booking cancelled locally.');
      }
    }
  };

  // Host Registration Submit
  const handleHostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLodgingName || !newHostName || !newRegion || !newDescription) {
      showToast('Please fill out all required fields.');
      return;
    }

    // Auth Guard for hosting
    if (isSupabaseConfigured && !user) {
      setAuthMode('login');
      setAuthModalOpen(true);
      showToast('Please sign in or sign up to list a property.');
      return;
    }

    const defaultImg1 = 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=800&h=500&q=80';
    const defaultImg2 = 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&h=500&q=80';

    const newLodging: Lodging = {
      id: `lodging-${Date.now()}`,
      name: newLodgingName,
      hostName: newHostName,
      hostAvatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
      region: newRegion,
      country: newCountry,
      pricePerNight: Number(newPrice),
      rating: 5.0,
      reviewsCount: 1,
      description: newDescription,
      imageUrls: [newImageUrl1 || defaultImg1, newImageUrl2 || defaultImg2],
      amenities: ['Wifi', 'Warm Showers', 'Gear Storage'],
      bikepackSpecs: {
        storageType: newStorageType,
        toolKitBrand: newToolBrand || 'Standard Bicycle Tool Kit',
        hasWashStation: newHasWash,
        hasLaundry: newHasLaundry,
        breakfastCalories: Number(newCalories),
        hasSparesInventory: newHasSpares,
        rideInOut: newRideInOut,
        accessNotes: newAccessNotes,
        sparesList: newSparesList.split(',').map(s => s.trim()).filter(Boolean),
        fuelMenuName: newFuelMenuName,
        fuelMenuDescription: newFuelMenuDescription
      },
      maxBikes: Number(newMaxBikes),
      coordinates: { lat: 43.0 + Math.random() * 5, lng: -110.0 + Math.random() * 10 } 
    };

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase.from('lodgings').insert(mapLodgingToDb(newLodging));
        if (error) throw error;
        setListings([newLodging, ...listings]);
        showToast('Your bike-friendly stay has been listed on Supabase DB!');
      } catch (err: any) {
        console.error('Supabase host listing error:', err);
        showToast(`Failed to save listing to database: ${err.message}`);
        return;
      }
    } else {
      setListings([newLodging, ...listings]);
      showToast('Your bike-friendly stay has been listed locally!');
    }
    
    // Clear Form
    setNewLodgingName('');
    setNewHostName('');
    setNewRegion('');
    setNewPrice(100);
    setNewDescription('');
    setNewImageUrl1('');
    setNewImageUrl2('');
    setNewMaxBikes(4);
    setNewStorageType('Indoor Garage');
    setNewToolBrand('Park Tool Kit');
    setNewHasWash(false);
    setNewHasLaundry(false);
    setNewCalories(800);
    setNewHasSpares(false);
    setNewRideInOut('Easy Gravel');
    setNewAccessNotes('');
    setNewSparesList('');
    setNewFuelMenuName('');
    setNewFuelMenuDescription('');

    setActiveTab('listings');
  };



  // Initialize Map
  useEffect(() => {
    if (activeTab !== 'listings' || !mapContainerRef.current) {
      return;
    }

    const leafletMap = L.map(mapContainerRef.current, {
      center: [42.0, -40.0],
      zoom: 3,
      zoomControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19
    }).addTo(leafletMap);

    L.control.zoom({ position: 'topright' }).addTo(leafletMap);

    const group = L.featureGroup().addTo(leafletMap);

    setMap(leafletMap);
    setMarkersGroup(group);

    return () => {
      leafletMap.remove();
      setMap(null);
      setMarkersGroup(null);
      polylineRef.current = null;
    };
  }, [activeTab]);

  // Update markers & path line
  useEffect(() => {
    if (activeTab !== 'listings' || !map || !markersGroup) return;

    // Clear old layers
    markersGroup.clearLayers();

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (filteredListings.length === 0) return;

    const latLngs: L.LatLngTuple[] = [];

    // Render lodging markers
    filteredListings.forEach((lodging) => {
      const isHovered = hoveredLodgingId === lodging.id;
      
      const icon = L.divIcon({
        className: 'leaflet-custom-marker-wrapper',
        html: `
          <div class="map-marker-pin ${isHovered ? 'active' : ''}">
            <i class="fa-solid fa-location-pin"></i>
            <span>$${lodging.pricePerNight}</span>
          </div>
        `,
        iconSize: [60, 30],
        iconAnchor: [30, 30]
      });

      const marker = L.marker([lodging.coordinates.lat, lodging.coordinates.lng], { icon });
      
      marker.on('click', () => {
        setSelectedLodging(lodging);
        setModalSubTab('overview');
      });

      marker.on('mouseover', () => {
        setHoveredLodgingId(lodging.id);
      });
      
      marker.on('mouseout', () => {
        setHoveredLodgingId(null);
      });

      marker.addTo(markersGroup);
      latLngs.push([lodging.coordinates.lat, lodging.coordinates.lng]);
    });

    // Render route line if GPX uploaded
    if (gpxFilterActive && gpxRoutePoints.length > 0) {
      const activeRoute: L.LatLngTuple[] = gpxRoutePoints.map(p => [p.lat, p.lng]);

      const polyline = L.polyline(activeRoute, {
        color: '#a3e635',
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 10',
        className: 'map-path-line'
      }).addTo(map);
      
      polylineRef.current = polyline;
      activeRoute.forEach(coord => latLngs.push(coord));

      // Render interactive bike tracking indicator
      if (hoveredGpxPoint) {
        const bicycleIcon = L.divIcon({
          className: 'leaflet-custom-marker-wrapper',
          html: `
            <div class="map-marker-bicycle" style="background-color: var(--accent-lime); border: 2px solid var(--bg-primary); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(163, 230, 53, 0.9); animation: pulse 1.5s infinite;">
              <i class="fa-solid fa-bicycle" style="color: var(--bg-primary); font-size: 0.85rem;"></i>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        
        const bikeMarker = L.marker([hoveredGpxPoint.lat, hoveredGpxPoint.lng], { icon: bicycleIcon })
          .addTo(markersGroup);
          
        bikeMarker.bindTooltip(`
          <div style="font-family: 'Outfit', sans-serif; font-size: 0.75rem; font-weight: 600; padding: 2px 4px;">
            ${hoveredGpxPoint.dist} km | Elevation: ${hoveredGpxPoint.ele}m
          </div>
        `, { permanent: true, direction: 'top', offset: [0, -12] });
      }
    }

    // Render routing start and end pins
    if (routingStart) {
      const startIcon = L.divIcon({
        className: 'leaflet-custom-marker-wrapper',
        html: `
          <div class="map-marker-route-point" style="background-color: var(--accent-lime); border: 2px solid var(--bg-primary); border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--bg-primary); font-size: 0.75rem; box-shadow: 0 0 10px rgba(163, 230, 53, 0.7);">
            S
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker(routingStart, { icon: startIcon }).addTo(markersGroup);
      latLngs.push(routingStart);
    }

    if (routingEnd) {
      const endIcon = L.divIcon({
        className: 'leaflet-custom-marker-wrapper',
        html: `
          <div class="map-marker-route-point" style="background-color: #ef4444; border: 2px solid var(--bg-primary); border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 0.75rem; box-shadow: 0 0 10px rgba(239, 68, 68, 0.7);">
            E
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker(routingEnd, { icon: endIcon }).addTo(markersGroup);
      latLngs.push(routingEnd);
    }

    // Render group members locations (Live Group Tracker)
    if (groupRideCode && Object.keys(groupMembers).length > 0) {
      Object.keys(groupMembers).forEach((id) => {
        const peer = groupMembers[id];
        const peerIcon = L.divIcon({
          className: 'leaflet-custom-marker-wrapper',
          html: `
            <div class="map-marker-peer" style="background-color: ${peer.status === 'lost' ? '#ef4444' : peer.status === 'warn' ? '#f59e0b' : '#3b82f6'}; border: 2px solid var(--bg-primary); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(59, 130, 246, 0.7);">
              <i class="fa-solid fa-user-large" style="color: white; font-size: 0.7rem;"></i>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const peerMarker = L.marker([peer.lat, peer.lng], { icon: peerIcon }).addTo(markersGroup);
        peerMarker.bindTooltip(`
          <div style="font-family: 'Outfit', sans-serif; font-size: 0.75rem; font-weight: 700; padding: 2px 4px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px;">
            👤 ${peer.name} (${peer.distance}m)
          </div>
        `, { permanent: true, direction: 'top', offset: [0, -14] });
        
        latLngs.push([peer.lat, peer.lng]);
      });
    }

    // Render my current location pin for group if sharing is active
    if (groupRideCode && isSharingLocation && myLocationForGroup) {
      const myIcon = L.divIcon({
        className: 'leaflet-custom-marker-wrapper',
        html: `
          <div class="map-marker-me" style="background-color: var(--accent-lime); border: 2px solid var(--bg-primary); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(163, 230, 53, 0.7);">
            <i class="fa-solid fa-location-crosshairs" style="color: var(--bg-primary); font-size: 0.85rem;"></i>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const myMarker = L.marker(myLocationForGroup, { icon: myIcon }).addTo(markersGroup);
      myMarker.bindTooltip(`
        <div style="font-family: 'Outfit', sans-serif; font-size: 0.75rem; font-weight: 700; padding: 2px 4px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--accent-lime); border-radius: 4px;">
          ⭐️ Me (${groupNickname})
        </div>
      `, { permanent: true, direction: 'top', offset: [0, -14] });
      
      latLngs.push(myLocationForGroup);
    }

    if (latLngs.length > 0) {
      map.fitBounds(latLngs, {
        padding: [50, 50],
        maxZoom: 13
      });
    }
  }, [map, markersGroup, filteredListings, gpxFilterActive, gpxFileName, hoveredLodgingId, hoveredGpxPoint, gpxRoutePoints, activeTab, routingStart, routingEnd, groupRideCode, groupMembers, isSharingLocation, myLocationForGroup, groupNickname]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section" onClick={() => { setActiveTab('listings'); setSelectedLodging(null); }}>
          <i className="fa-solid fa-gear logo-icon"></i>
          <h1 className="logo-text">Bikepack Boarding</h1>
        </div>
        <nav className="header-nav">
          <button 
            className={`nav-btn ${activeTab === 'listings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('listings'); setSelectedLodging(null); }}
          >
            Find Stays
          </button>
          <button 
            className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            My Bookings ({bookings.length})
          </button>
          <button 
            className={`nav-btn active-accent ${activeTab === 'host' ? 'active-accent' : ''}`}
            onClick={() => setActiveTab('host')}
          >
            Host Cyclists
          </button>
          
          {/* Supabase Auth Badge */}
          {isSupabaseConfigured ? (
            user ? (
              <div className="auth-user-badge">
                <span className="user-email" title={user.email}><i className="fa-solid fa-user"></i> {user.email?.split('@')[0]}</span>
                <button className="nav-btn-outline" onClick={handleSignOut}>Sign Out</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="nav-btn-outline" onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}>
                  Sign In
                </button>
                <button className="nav-btn active-accent" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => { setAuthMode('signup'); setAuthModalOpen(true); }}>
                  Sign Up
                </button>
              </div>
            )
          ) : (
            <span className="local-mode-badge" title="Running in Local Fallback mode (no credentials)">Local Mode</span>
          )}
        </nav>
      </header>

      {/* Main Sections based on Tab */}
      {activeTab === 'listings' && (
        <div className="listings-page-wrapper">
          
          {/* Left Side: Stays List & Filters */}
          <section className="left-listings-pane">
            
            {/* Airbnb Style Filter panel */}
            <div className="inline-filters-container">
              <div className="filter-row-top">
                {/* Region */}
                <div className="filter-box-item">
                  <span className="filter-label">Destination</span>
                  <select 
                    className="filter-select"
                    value={searchRegion}
                    onChange={(e) => setSearchRegion(e.target.value)}
                  >
                    <option value="All">Global (All)</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
                
                {/* Max Price */}
                <div className="filter-box-item">
                  <span className="filter-label">Max Price (${maxPrice})</span>
                  <input 
                    type="range" 
                    min="80" 
                    max="300" 
                    step="10"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="filter-input"
                    style={{ padding: '0.2rem' }}
                  />
                </div>

                {/* Storage */}
                <div className="filter-box-item">
                  <span className="filter-label">Secure Storage</span>
                  <select 
                    className="filter-select"
                    value={storageFilter}
                    onChange={(e) => setStorageFilter(e.target.value)}
                  >
                    <option value="All">Any Storage</option>
                    <option value="Indoor Garage">Indoor Garage</option>
                    <option value="Locked Shed">Locked Shed</option>
                    <option value="In-Room Rack">In-Room Rack</option>
                    <option value="Secure Covered Patio">Covered Patio</option>
                  </select>
                </div>

                {/* Fuel */}
                <div className="filter-box-item">
                  <span className="filter-label">Breakfast Fuel</span>
                  <select 
                    className="filter-select"
                    value={minCalories}
                    onChange={(e) => setMinCalories(Number(e.target.value))}
                  >
                    <option value="0">Any Calories</option>
                    <option value="900">Heavy (&gt;900 kcal)</option>
                    <option value="1100">Cyclist Fuel (&gt;1100 kcal)</option>
                    <option value="1200">Gravel Fuel (&gt;1200 kcal)</option>
                  </select>
                </div>

                {/* Ride-in, Ride-out */}
                <div className="filter-box-item">
                  <span className="filter-label">Ride-in, Ride-out</span>
                  <select 
                    className="filter-select"
                    value={rideInOutFilter}
                    onChange={(e) => setRideInOutFilter(e.target.value)}
                  >
                    <option value="All">Any Road Type</option>
                    <option value="Easy Gravel">Easy Gravel</option>
                    <option value="Steep Asphalt Climb">Steep Asphalt Climb</option>
                    <option value="Singletrack Trail">Singletrack Trail</option>
                    <option value="Highway Shoulder">Highway Shoulder</option>
                  </select>
                </div>
              </div>

              {/* Amenity Switches */}
              <div className="amenities-chips-row">
                <button 
                  className={`amenity-filter-chip ${requireWash ? 'active' : ''}`}
                  onClick={() => setRequireWash(!requireWash)}
                >
                  <i className="fa-solid fa-soap"></i> Bike Wash Station
                </button>
                <button 
                  className={`amenity-filter-chip ${requireSpares ? 'active' : ''}`}
                  onClick={() => setRequireSpares(!requireSpares)}
                >
                  <i className="fa-solid fa-toolbox"></i> Spares & Tubes Inventory
                </button>
                <button 
                  className={`amenity-filter-chip ${requireLaundry ? 'active' : ''}`}
                  onClick={() => setRequireLaundry(!requireLaundry)}
                >
                  <i className="fa-solid fa-shirt"></i> Wet-Weather Laundry
                </button>
              </div>
            </div>

            {/* GPX Upload Simulation Panel */}
            <div className={`gpx-uploader-box ${gpxFilterActive ? 'active' : ''}`}>
              <div className="gpx-info-pane">
                <i className="fa-solid fa-map-location-dot gpx-icon"></i>
                <div className="gpx-texts">
                  <h5>Filter by GPX Route Proximity</h5>
                  <p>Upload your bikepacking path file to find stays within 5km of your journey.</p>
                </div>
              </div>
              
              {!gpxFileName ? (
                <div className="gpx-upload-btn-wrapper">
                  <button className="btn-gpx">Upload Route (.gpx)</button>
                  <input 
                    type="file" 
                    accept=".gpx" 
                    onChange={handleGpxUpload} 
                    className="gpx-upload-input" 
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="gpx-active-badge">
                    <i className="fa-solid fa-route"></i> {gpxFileName.slice(0, 18)}...
                  </div>
                  <button className="btn-clear-gpx" onClick={clearGpxFilter} title="Remove GPX filter">
                    <i className="fa-solid fa-circle-xmark"></i>
                  </button>
                </div>
              )}
            </div>

            {/* Bikepacking Route Finder Panel */}
            <div className={`gpx-uploader-box ${isRoutingMode ? 'active' : ''}`} style={{ marginTop: '1rem', border: isRoutingMode ? '1px solid var(--accent-lime)' : '1px solid var(--border-color)' }}>
              <div className="gpx-info-pane">
                <i className="fa-solid fa-route gpx-icon" style={{ color: isRoutingMode ? 'var(--accent-lime)' : 'var(--text-secondary)' }}></i>
                <div className="gpx-texts">
                  <h5>Start-End Route Finder (BETA)</h5>
                  <p>Click two points on the map to calculate the optimal bicycle navigation route.</p>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {!isRoutingMode ? (
                  <button 
                    className="btn-gpx" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => {
                      setIsRoutingMode(true);
                      setRoutingStart(null);
                      setRoutingEnd(null);
                    }}
                  >
                    <i className="fa-solid fa-location-crosshairs"></i> Enable Route Finder
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Status helper text */}
                    <div style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      {!routingStart ? (
                        <span style={{ color: 'var(--accent-lime)' }}><i className="fa-solid fa-circle-play"></i> Step 1: Search location or click on map for <strong>Start (S)</strong>.</span>
                      ) : !routingEnd ? (
                        <span style={{ color: '#f59e0b' }}><i className="fa-solid fa-circle-play"></i> Step 2: Search location or click on map for <strong>End (E)</strong>.</span>
                      ) : (
                        <span style={{ color: 'var(--accent-lime)' }}><i className="fa-solid fa-circle-check"></i> Route parsed successfully!</span>
                      )}
                    </div>

                    {/* Start Input Search */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>🟢 Start Location</label>
                        <button
                          type="button"
                          onClick={useCurrentLocationAsStart}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-lime)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0, fontWeight: 500 }}
                          title="Use device GPS to set start"
                        >
                          <i className="fa-solid fa-location-arrow"></i> Use My GPS
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input
                          type="text"
                          className="search-input"
                          style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                          placeholder="Search start (e.g., Seoul)..."
                          value={startSearchQuery}
                          onChange={(e) => setStartSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchLocation(startSearchQuery, 'start');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn-gpx"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleSearchLocation(startSearchQuery, 'start')}
                          disabled={searchingStart}
                        >
                          {searchingStart ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                        </button>
                      </div>

                      {/* Start Search Results Dropdown */}
                      {startSearchResults.length > 0 && (
                        <div style={{ position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '150px', overflowY: 'auto', marginTop: '2px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                          {startSearchResults.map((item, idx) => (
                            <div
                              key={idx}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.2s', color: 'var(--text-primary)' }}
                              onClick={() => selectSearchResult(item, 'start')}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              {item.display_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* End Input Search */}
                    <div style={{ position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>🔴 End Location</label>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input
                          type="text"
                          className="search-input"
                          style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                          placeholder="Search destination (e.g., Busan)..."
                          value={endSearchQuery}
                          onChange={(e) => setEndSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchLocation(endSearchQuery, 'end');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn-gpx"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => handleSearchLocation(endSearchQuery, 'end')}
                          disabled={searchingEnd}
                        >
                          {searchingEnd ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                        </button>
                      </div>

                      {/* End Search Results Dropdown */}
                      {endSearchResults.length > 0 && (
                        <div style={{ position: 'absolute', zIndex: 1000, top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', maxHeight: '150px', overflowY: 'auto', marginTop: '2px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                          {endSearchResults.map((item, idx) => (
                            <div
                              key={idx}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.2s', color: 'var(--text-primary)' }}
                              onClick={() => selectSearchResult(item, 'end')}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              {item.display_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Start/End coordinates labels as secondary info */}
                    {(routingStart || routingEnd) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {routingStart && <div>🟢 Lat/Lng: {routingStart[0].toFixed(4)}, {routingStart[1].toFixed(4)}</div>}
                        {routingEnd && <div>🔴 Lat/Lng: {routingEnd[0].toFixed(4)}, {routingEnd[1].toFixed(4)}</div>}
                      </div>
                    )}

                    {routingLoading && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-lime)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fa-solid fa-circle-notch fa-spin"></i> Calculating optimal bicycle path...
                      </div>
                    )}

                    <button 
                      className="btn-clear-gpx" 
                      style={{ width: '100%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                      onClick={clearRouteFinder}
                    >
                      <i className="fa-solid fa-trash-can"></i> Clear & Reset Route
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Live Group Tracking Panel */}
            <div className="gpx-uploader-box" style={{ marginTop: '1.0rem', border: groupRideCode ? '1px solid var(--accent-lime)' : '1px solid var(--border-color)' }}>
              <div className="gpx-info-pane">
                <i className="fa-solid fa-users-gear gpx-icon" style={{ color: groupRideCode ? 'var(--accent-lime)' : 'var(--text-secondary)' }}></i>
                <div className="gpx-texts">
                  <h5>👥 Live Group Tracker</h5>
                  <p>Share locations and track peer riders in real-time to prevent dropouts.</p>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {!groupRideCode ? (
                  // Join or Create Ride
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <input
                        type="text"
                        placeholder="Rider Nickname"
                        className="search-input"
                        style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                        value={groupNickname}
                        onChange={(e) => setGroupNickname(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                      {!showJoinInput ? (
                        <>
                          <button
                            className="btn-gpx"
                            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.7rem' }}
                            onClick={() => {
                              const code = `RIDE-${Math.floor(1000 + Math.random() * 9000)}`;
                              setGroupRideCode(code);
                              setIsSharingLocation(true);
                            }}
                          >
                            Create Group Ride
                          </button>
                          <button
                            className="btn-clear-gpx"
                            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.7rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                            onClick={() => {
                              setShowJoinInput(true);
                              setJoinInputCode('');
                            }}
                          >
                            Join Code
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                          <input
                            type="text"
                            placeholder="Enter Code (e.g. RIDE-1234)"
                            className="search-input"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', width: '100%', textTransform: 'uppercase' }}
                            value={joinInputCode}
                            onChange={(e) => setJoinInputCode(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (joinInputCode.trim()) {
                                  setGroupRideCode(joinInputCode.trim().toUpperCase());
                                  setIsSharingLocation(true);
                                  setShowJoinInput(false);
                                }
                              }
                            }}
                          />
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn-gpx"
                              style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.65rem' }}
                              onClick={() => {
                                if (joinInputCode.trim()) {
                                  setGroupRideCode(joinInputCode.trim().toUpperCase());
                                  setIsSharingLocation(true);
                                  setShowJoinInput(false);
                                } else {
                                  showToast("Please enter a valid group code.");
                                }
                              }}
                            >
                              Join
                            </button>
                            <button
                              className="btn-clear-gpx"
                              style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.65rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                              onClick={() => setShowJoinInput(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Active Tracking Panel
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Session Code Info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Group Code: <strong style={{ color: 'var(--accent-lime)' }}>{groupRideCode}</strong>
                      </div>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}
                        onClick={() => {
                          setGroupRideCode(null);
                          setIsSharingLocation(false);
                          setMyLocationForGroup(null);
                        }}
                      >
                        Exit Group
                      </button>
                    </div>

                    {/* Nickname & Sharing Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Rider: <strong>{groupNickname}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn-gpx"
                        style={{ 
                          padding: '0.2rem 0.5rem', 
                          fontSize: '0.65rem', 
                          backgroundColor: isSharingLocation ? '#ef4444' : 'var(--accent-lime)',
                          color: isSharingLocation ? 'white' : 'var(--bg-primary)'
                        }}
                        onClick={() => setIsSharingLocation(!isSharingLocation)}
                      >
                        {isSharingLocation ? "⏸ Stop Share" : "▶️ Start Share"}
                      </button>
                    </div>

                    {/* GPS Alert status */}
                    {isSharingLocation && !myLocationForGroup && (
                      <div style={{ fontSize: '0.65rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <i className="fa-solid fa-spinner fa-spin"></i> Fetching your device GPS position...
                      </div>
                    )}

                    {/* Peers List with distance and warning */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Riders Status ({Object.keys(groupMembers).length + 1})</span>
                      
                      {/* My status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', padding: '0.2rem 0.35rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)' }}>
                        <span style={{ color: 'var(--accent-lime)', fontWeight: 600 }}>⭐️ {groupNickname} (Me)</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Leader</span>
                      </div>

                      {/* Peers status list */}
                      {Object.keys(groupMembers).length === 0 ? (
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
                          No other riders active yet. Share group code with friends to trace them!
                        </div>
                      ) : (
                        Object.keys(groupMembers).map((id) => {
                          const peer = groupMembers[id];
                          let statusLabel = "Normal";
                          let color = 'var(--accent-lime)';
                          
                          if (peer.status === 'lost') {
                            statusLabel = "🚨 Lost / Dropout";
                            color = '#ef4444';
                          } else if (peer.status === 'warn') {
                            statusLabel = "⚠️ Distant";
                            color = '#f59e0b';
                          }

                          return (
                            <div 
                              key={id} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                fontSize: '0.7rem', 
                                padding: '0.25rem 0.35rem', 
                                borderRadius: 'var(--radius-sm)', 
                                backgroundColor: 'var(--bg-primary)',
                                borderLeft: `3px solid ${color}`,
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                if (map) {
                                  map.setView([peer.lat, peer.lng], 14);
                                }
                              }}
                              title="Click to center map on rider"
                            >
                              <div>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>👤 {peer.name}</span>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  Distance: {peer.distance}m behind
                                </div>
                              </div>
                              <span style={{ fontSize: '0.65rem', color, fontWeight: 700 }}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GPX Elevation & Route Guide Dashboard */}
            {gpxFilterActive && gpxRoutePoints.length > 0 && (
              <div className="gpx-dashboard-card" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <ElevationProfile 
                  points={gpxRoutePoints}
                  hoveredPoint={hoveredGpxPoint}
                  onHoverPoint={setHoveredGpxPoint}
                />

                {/* Timeline Route Guide */}
                <div className="route-stages-timeline" style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <i className="fa-solid fa-compass" style={{ color: 'var(--accent-lime)' }}></i>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Route Navigation Stages</span>
                  </div>

                  <div className="timeline-items" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', paddingLeft: '1rem', borderLeft: '1px dashed var(--border-color)', margin: '0.25rem 0 0.25rem 0.5rem' }}>
                    {/* Start point */}
                    <div className="timeline-node" style={{ position: 'relative', fontSize: '0.75rem' }}>
                      <div style={{ position: 'absolute', left: '-1.45rem', top: '2px', backgroundColor: 'var(--border-color)', width: '8px', height: '8px', borderRadius: '50%' }}></div>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>🏁 START (0.0 km)</div>
                    </div>

                    {/* Stays on route sorted by their route distance */}
                    {filteredListings
                      .map(lodging => {
                        const routeDist = getLodgingDistanceOnRoute(lodging.coordinates, gpxRoutePoints);
                        return { lodging, routeDist };
                      })
                      .sort((a, b) => a.routeDist - b.routeDist)
                      .map(({ lodging, routeDist }) => (
                        <div 
                          key={lodging.id} 
                          className="timeline-node" 
                          style={{ position: 'relative', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
                          onClick={() => {
                            setSelectedLodging(lodging);
                            setModalSubTab('overview');
                            if (map) {
                              map.setView([lodging.coordinates.lat, lodging.coordinates.lng], 13);
                            }
                          }}
                          onMouseEnter={() => setHoveredLodgingId(lodging.id)}
                          onMouseLeave={() => setHoveredLodgingId(null)}
                        >
                          <div style={{ position: 'absolute', left: '-1.55rem', top: '1px', backgroundColor: 'var(--accent-lime)', width: '12px', height: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 5px rgba(163, 230, 53, 0.5)' }}>
                            <i className="fa-solid fa-house-chimney" style={{ fontSize: '0.45rem', color: 'var(--bg-primary)' }}></i>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 700, color: 'var(--accent-lime)' }}>{routeDist.toFixed(1)} km</span>
                              <span style={{ marginLeft: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>{lodging.name}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                              ${lodging.pricePerNight}
                            </span>
                          </div>
                        </div>
                      ))}

                    {/* End point */}
                    <div className="timeline-node" style={{ position: 'relative', fontSize: '0.75rem' }}>
                      <div style={{ position: 'absolute', left: '-1.45rem', top: '2px', backgroundColor: 'var(--border-color)', width: '8px', height: '8px', borderRadius: '50%' }}></div>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        🏁 END ({(gpxRoutePoints[gpxRoutePoints.length - 1]?.dist || 0.0).toFixed(1)} km)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!gpxFileName && (
              <div className="sample-routes-links">
                <span>Try a sample route:</span>
                <button className="sample-route-btn" onClick={() => loadSampleRoute('oregon')}>Oregon</button>
                <button className="sample-route-btn" onClick={() => loadSampleRoute('dolomites')}>Dolomites</button>
                <button className="sample-route-btn" onClick={() => loadSampleRoute('moab')}>Moab</button>
              </div>
            )}

            {/* Results Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Bike-friendly bases</h3>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{filteredListings.length} stays found</span>
            </div>

            {/* Card Grid */}
            {dbLoading ? (
              <div className="db-loading-overlay">
                <i className="fa-solid fa-spinner spinner-icon"></i>
                <p>Syncing stays from Supabase database...</p>
              </div>
            ) : filteredListings.length > 0 ? (
              <div className="grid-layout">
                {filteredListings.map((lodging) => (
                  <LodgingCard 
                    key={lodging.id} 
                    lodging={lodging} 
                    onSelect={(l) => { setSelectedLodging(l); setModalSubTab('overview'); }}
                    isHighlighted={hoveredLodgingId === lodging.id}
                    onHover={setHoveredLodgingId}
                  />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
                <i className="fa-solid fa-bicycle" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '1rem' }}></i>
                <p>No accommodations match the selected gear specifications.</p>
              </div>
            )}

          </section>

          {/* Right Side: Map Pane */}
          <section className="right-map-pane">
            <div className="map-control-overlay">
              <h4>Active Route Map</h4>
              <p>
                {gpxFilterActive && gpxFileName 
                  ? `Showing stays within 5km of ${gpxFileName.slice(0, 16)}`
                  : 'Interactive Vector Stays Map'}
              </p>
            </div>
            
            <div className="interactive-map-container">
              <div ref={mapContainerRef} className="leaflet-map-element" style={{ width: '100%', height: '100%', zIndex: 1 }} />
            </div>
          </section>

        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <main className="main-content">
          <div className="bookings-view">
            <h2>Your Booked Basecamps</h2>
            {bookings.length > 0 ? (
              bookings.map((booking) => (
                <div key={booking.id} className="booking-item-card">
                  <img src={booking.lodgingImage} alt={booking.lodgingName} className="booking-item-img" />
                  <div className="booking-item-details">
                    <h3 className="booking-item-title">{booking.lodgingName}</h3>
                    <div className="booking-item-dates">
                      <i className="fa-solid fa-calendar-days"></i> {booking.checkIn} to {booking.checkOut}
                    </div>
                    <div className="booking-item-specs">
                      <i className="fa-solid fa-bicycle"></i> {booking.numBikes} {booking.numBikes > 1 ? 'Bikes' : 'Bike'} registered
                    </div>
                    <div className="booking-item-price">Total Paid: ${booking.totalPrice}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <span className="booking-item-status status-confirmed">Confirmed</span>
                    <button 
                      className="cancel-booking-btn"
                      onClick={() => handleCancelBooking(booking.id)}
                    >
                      Cancel Stay
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-bookings">
                <i className="fa-solid fa-map-location-dot"></i>
                <p>No upcoming trips. Upload a route and book a secure basecamp.</p>
                <button 
                  className="nav-btn active-accent" 
                  style={{ marginTop: '1.5rem', display: 'inline-flex', alignSelf: 'center' }}
                  onClick={() => setActiveTab('listings')}
                >
                  Explore Stays
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* Host Tab */}
      {activeTab === 'host' && (
        <main className="main-content">
          <div className="host-view">
            <h2>Host Bikepackers</h2>
            <p>List your stay and support the global bikepacking community with essential gear.</p>
            
            {isSupabaseConfigured && !user ? (
              <div className="auth-prompt-card" style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginTop: '2rem' }}>
                <i className="fa-solid fa-lock auth-lock-icon" style={{ fontSize: '2.5rem', color: 'var(--accent-lime)', marginBottom: '1rem' }}></i>
                <h3>Sign In Required</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>You must have an account and be signed in to subscribe to the Host Tier and list accommodations.</p>
                <button className="form-btn" style={{ padding: '0.6rem 2rem' }} onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}>
                  Sign In / Sign Up
                </button>
              </div>
            ) : !isSubscribed() ? (
              <div className="pricing-view" style={{ marginTop: '2rem' }}>
                <p className="pricing-subtitle" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Become a Certified Bikepacker Basecamp host to list your property and receive bookings.</p>
                
                <div className="pricing-cards-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                  {/* Card 1: Free Tier */}
                  <div className="pricing-card disabled" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative', opacity: 0.75 }}>
                    <div className="card-badge" style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'var(--border-color)', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>Current Tier</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Explorer Tier</h3>
                    <div className="card-price" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Free <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ forever</span></div>
                    <p className="card-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Perfect for testing the waters and exploring stays.</p>
                    <ul className="card-features" style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <li><i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-lime)', marginRight: '0.5rem' }}></i> Search & book stays globally</li>
                      <li><i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-lime)', marginRight: '0.5rem' }}></i> Upload GPX files</li>
                      <li><i className="fa-solid fa-circle-xmark" style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}></i> Host listings</li>
                      <li><i className="fa-solid fa-circle-xmark" style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}></i> Tool kit badge</li>
                    </ul>
                    <button className="nav-btn-outline" style={{ marginTop: 'auto', width: '100%', cursor: 'not-allowed' }} disabled>Active Plan</button>
                  </div>

                  {/* Card 2: Host Tier (Paid via Lemon Squeezy) */}
                  <div className="pricing-card premium" style={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--accent-lime)', borderRadius: 'var(--radius-md)', padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 0 15px rgba(163, 230, 53, 0.15)' }}>
                    <div className="card-badge premium-badge" style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'var(--accent-lime)', color: 'var(--bg-primary)', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>Best Value</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Bikepacker Host Tier</h3>
                    <div className="card-price" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-lime)', marginBottom: '1rem' }}>$19 <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ month</span></div>
                    <p className="card-desc" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>For hosts providing secure storage and toolkits.</p>
                    <ul className="card-features" style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <li><i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-lime)', marginRight: '0.5rem' }}></i> List unlimited lodging properties</li>
                      <li><i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-lime)', marginRight: '0.5rem' }}></i> Earn verified "Secured Storage" badge</li>
                      <li><i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-lime)', marginRight: '0.5rem' }}></i> Feature on GPX proximity searches</li>
                      <li><i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-lime)', marginRight: '0.5rem' }}></i> Direct Guest chat & notifications</li>
                    </ul>
                    
                    {/* Lemon Squeezy checkout link */}
                    <a 
                      href={import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL || "https://yourstore.lemonsqueezy.com/checkout/buy/your-product-variant-id?embed=1"} 
                      className="form-btn lemonsqueezy-button"
                      style={{ marginTop: 'auto', textDecoration: 'none', textAlign: 'center', display: 'block' }}
                      onClick={(e) => {
                        const checkoutUrl = import.meta.env.VITE_LEMON_SQUEEZY_CHECKOUT_URL;
                        if (!checkoutUrl || checkoutUrl.includes('yourstore')) {
                          e.preventDefault();
                          showToast('Lemon Squeezy Checkout URL is not configured. Please set VITE_LEMON_SQUEEZY_CHECKOUT_URL in your .env file. For sandbox testing, use the bypass button below.');
                        }
                      }}
                    >
                      Subscribe to Host
                    </a>
                    
                    {/* Bypass / Test Mode controls */}
                    <div className="pricing-test-controls" style={{ marginTop: '1.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', textAlign: 'center' }}>
                      <span className="test-badge" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Local Sandbox Testing</span>
                      <button className="nav-btn-outline" style={{ fontSize: '0.75rem', width: '100%', borderColor: 'var(--accent-lime)', color: 'var(--accent-lime)' }} onClick={handleBypassSubscription}>
                        Bypass & Activate (Free Test)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Active Subscription Status Banner */}
                <div className="host-subscribed-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: 'rgba(163, 230, 53, 0.1)', color: 'var(--accent-lime)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-circle-check" style={{ fontSize: '1.25rem' }}></i>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Host Membership Active</h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>You are certified to host lodgings and mechanical gear.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <a 
                      href={import.meta.env.VITE_LEMON_SQUEEZY_PORTAL_URL || "https://yourstore.lemonsqueezy.com/billing"} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="nav-btn-outline" 
                      style={{ fontSize: '0.75rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem' }}
                      onClick={(e) => {
                        const portalUrl = import.meta.env.VITE_LEMON_SQUEEZY_PORTAL_URL;
                        if (!portalUrl || portalUrl.includes('yourstore')) {
                          e.preventDefault();
                          showToast('Lemon Squeezy Customer Billing Portal URL is not configured. Please set VITE_LEMON_SQUEEZY_PORTAL_URL in your .env file.');
                        }
                      }}
                    >
                      <i className="fa-solid fa-credit-card"></i> Manage Billing
                    </a>
                    <button 
                      onClick={handleResetSubscription} 
                      className="nav-btn-outline" 
                      style={{ fontSize: '0.75rem', borderColor: 'var(--border-color)', color: 'var(--text-muted)', padding: '0.4rem 1rem' }}
                    >
                      Downgrade (Test)
                    </button>
                  </div>
                </div>

                <form onSubmit={handleHostSubmit} className="host-form">
                  <div className="form-section-title">Base Property Specs</div>
                  <div className="form-grid-2">
                    <div className="input-row">
                      <label>Lodging Name *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g., Summit Ridge Gravel Lodge"
                        className="widget-input"
                        value={newLodgingName}
                        onChange={(e) => setNewLodgingName(e.target.value)}
                      />
                    </div>
                    <div className="input-row">
                      <label>Host Name *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g., Alex Carter"
                        className="widget-input"
                        value={newHostName}
                        onChange={(e) => setNewHostName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="input-row">
                      <label>Region/State *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g., Oregon Cascades"
                        className="widget-input"
                        value={newRegion}
                        onChange={(e) => setNewRegion(e.target.value)}
                      />
                    </div>
                    <div className="input-row">
                      <label>Country *</label>
                      <select 
                        className="filter-select"
                        style={{ minWidth: '100%' }}
                        value={newCountry}
                        onChange={(e) => setNewCountry(e.target.value)}
                      >
                        <option value="United States">United States</option>
                        <option value="Italy">Italy</option>
                        <option value="France">France</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Canada">Canada</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="input-row">
                      <label>Price per Night ($) *</label>
                      <input 
                        type="number" 
                        required 
                        min="30"
                        className="widget-input"
                        value={newPrice}
                        onChange={(e) => setNewPrice(Number(e.target.value))}
                      />
                    </div>
                    <div className="input-row">
                      <label>Max Bikes Accommodated *</label>
                      <input 
                        type="number" 
                        required 
                        min="1"
                        className="widget-input"
                        value={newMaxBikes}
                        onChange={(e) => setNewMaxBikes(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="input-row">
                    <label>Description *</label>
                    <textarea 
                      required 
                      rows={4}
                      placeholder="Detail your secure lockups, bike stand availability, food options..."
                      className="widget-input"
                      style={{ resize: 'vertical' }}
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                  </div>

                  <div className="form-grid-2">
                    <div className="input-row">
                      <label>Main Image URL (Optional)</label>
                      <input 
                        type="url" 
                        placeholder="Paste a direct image URL for the cover"
                        className="widget-input"
                        value={newImageUrl1}
                        onChange={(e) => setNewImageUrl1(e.target.value)}
                      />
                    </div>
                    <div className="input-row">
                      <label>Second Image URL (Optional)</label>
                      <input 
                        type="url" 
                        placeholder="Paste a second image URL"
                        className="widget-input"
                        value={newImageUrl2}
                        onChange={(e) => setNewImageUrl2(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-section-title" style={{ marginTop: '1rem' }}>Cyclist Infrastructure Specs</div>
                  
                  <div className="form-grid-2">
                    <div className="input-row">
                      <label>Bike Storage Type *</label>
                      <select 
                        className="filter-select" 
                        style={{ minWidth: '100%' }}
                        value={newStorageType}
                        onChange={(e) => setNewStorageType(e.target.value as BikepackSpecs['storageType'])}
                      >
                        <option value="Indoor Garage">Indoor Garage (Heated/Secured)</option>
                        <option value="Locked Shed">Locked Outhouse/Shed</option>
                        <option value="In-Room Rack">In-Room Custom Rack</option>
                        <option value="Secure Covered Patio">Secure Covered Patio</option>
                      </select>
                    </div>
                    <div className="input-row">
                      <label>Workstand & Tool Kit Brand</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Park Tool Pro Kit"
                        className="widget-input"
                        value={newToolBrand}
                        onChange={(e) => setNewToolBrand(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
                    <div className="input-row">
                      <label>Ride-in, Ride-out Accessibility *</label>
                      <select 
                        className="filter-select"
                        style={{ minWidth: '100%' }}
                        value={newRideInOut}
                        onChange={(e) => setNewRideInOut(e.target.value as BikepackSpecs['rideInOut'])}
                      >
                        <option value="Easy Gravel">Easy Gravel Path</option>
                        <option value="Steep Asphalt Climb">Steep Asphalt Climb</option>
                        <option value="Singletrack Trail">Singletrack Trail Access</option>
                        <option value="Highway Shoulder">Highway Shoulder Only</option>
                      </select>
                    </div>
                    <div className="input-row">
                      <label>Access Notes (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Last 300m is gravel, direct access to trails"
                        className="widget-input"
                        value={newAccessNotes}
                        onChange={(e) => setNewAccessNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="input-row">
                      <label>High-Carb Breakfast Fuel (kcal) *</label>
                      <input 
                        type="number" 
                        required 
                        min="500"
                        step="50"
                        className="widget-input"
                        value={newCalories}
                        onChange={(e) => setNewCalories(Number(e.target.value))}
                      />
                    </div>
                    <div className="input-row" style={{ justifyContent: 'center', gap: '0.8rem' }}>
                      <div className="checkbox-group">
                        <input 
                          type="checkbox" 
                          id="hasWash"
                          checked={newHasWash}
                          onChange={(e) => setNewHasWash(e.target.checked)}
                        />
                        <label htmlFor="hasWash">Bike Wash Station Available</label>
                      </div>
                      <div className="checkbox-group">
                        <input 
                          type="checkbox" 
                          id="hasLaundry"
                          checked={newHasLaundry}
                          onChange={(e) => setNewHasLaundry(e.target.checked)}
                        />
                        <label htmlFor="hasLaundry">Wet-Weather Laundry Access</label>
                      </div>
                      <div className="checkbox-group">
                        <input 
                          type="checkbox" 
                          id="hasSpares"
                          checked={newHasSpares}
                          onChange={(e) => setNewHasSpares(e.target.checked)}
                        />
                        <label htmlFor="hasSpares">Tubes & Spares Inventory</label>
                      </div>
                    </div>
                  </div>

                  {/* Spares List & Fuel Menu Details */}
                  <div className="form-grid-2" style={{ marginTop: '1rem' }}>
                    <div className="input-row">
                      <label>Spares Inventory List (Optional, comma-separated)</label>
                      <input 
                        type="text" 
                        placeholder="e.g., 700x38c Tubes, Chain Lube, Patch Kit"
                        className="widget-input"
                        value={newSparesList}
                        onChange={(e) => setNewSparesList(e.target.value)}
                      />
                    </div>
                    <div className="input-row">
                      <label>Fuel Menu Name (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g., High-Oat Energy Breakfast"
                        className="widget-input"
                        value={newFuelMenuName}
                        onChange={(e) => setNewFuelMenuName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-row" style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
                    <label>Fuel Menu Description (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Describe what high-carb carbohydrates, espresso, or snacks you provide..."
                      className="widget-input"
                      style={{ resize: 'vertical' }}
                      value={newFuelMenuDescription}
                      onChange={(e) => setNewFuelMenuDescription(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="form-btn">List Property</button>
                </form>

                {/* Reset Subscription Helper for Testing */}
                <div style={{ marginTop: '2rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent-lime)', marginRight: '0.4rem' }}></i>
                    Active Host Tier Subscription
                  </span>
                  <button className="nav-btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={handleResetSubscription}>
                    Cancel Subscription (Test Reset)
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {selectedLodging && (
        <div className="modal-overlay" onClick={() => setSelectedLodging(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedLodging(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            
            {/* Gallery system */}
            {(() => {
              const urls = getImageUrls(selectedLodging);
              const defaultImg = 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=800&h=500&q=80';
              return (
                <div className="modal-gallery-wrapper">
                  <img src={urls[0] || defaultImg} alt={selectedLodging.name} className="gallery-main-img" />
                  <div className="gallery-sub-pane">
                    <img src={urls[1] || urls[0] || defaultImg} alt="" className="gallery-sub-img" />
                    <img src={urls[2] || urls[0] || defaultImg} alt="" className="gallery-sub-img" />
                  </div>
                </div>
              );
            })()}
            
            <div className="modal-body">
              <div className="modal-main">
                <div className="modal-title-sec">
                  <h2>{selectedLodging.name}</h2>
                  <div className="modal-meta-row">
                    <span><i className="fa-solid fa-location-dot"></i> {selectedLodging.region}, {selectedLodging.country}</span>
                    <span><i className="fa-solid fa-star star-icon"></i> {selectedLodging.rating} ({selectedLodging.reviewsCount} reviews)</span>
                  </div>
                </div>

                {/* Sub Tab Headers */}
                <div className="modal-tabs-header">
                  <button 
                    className={`modal-tab-btn ${modalSubTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setModalSubTab('overview')}
                  >
                    Stay Overview
                  </button>
                  <button 
                    className={`modal-tab-btn ${modalSubTab === 'mechanics' ? 'active' : ''}`}
                    onClick={() => setModalSubTab('mechanics')}
                  >
                    Bikepacking Gear & Mechanics
                  </button>
                </div>

                {modalSubTab === 'overview' ? (
                  <div className="modal-tab-pane">
                    <p className="description-text">{selectedLodging.description}</p>
                    
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Amenities</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {selectedLodging.amenities.map((amenity) => (
                          <span key={amenity} className="amenity-filter-chip" style={{ cursor: 'default' }}>
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Fuel Menu Integration */}
                    {selectedLodging.bikepackSpecs.fuelMenuName && (
                      <div className="fuel-menu-section" style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="fa-solid fa-cookie-bite" style={{ color: 'var(--accent-lime)' }}></i>
                            {selectedLodging.bikepackSpecs.fuelMenuName}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--accent-lime)', backgroundColor: 'rgba(163, 230, 53, 0.1)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                            {selectedLodging.bikepackSpecs.breakfastCalories} kcal Carb Fuel
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {selectedLodging.bikepackSpecs.fuelMenuDescription}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="modal-tab-pane">
                    <div className="modal-specs-box">
                      <div className="specs-grid">
                        <div className="spec-block">
                          <span className="label">Storage Type</span>
                          <span className="value">
                            <i className="fa-solid fa-warehouse"></i> {selectedLodging.bikepackSpecs.storageType}
                          </span>
                        </div>
                        <div className="spec-block">
                          <span className="label">Available Tool Kit</span>
                          <span className="value">
                            <i className="fa-solid fa-screwdriver-wrench"></i> {selectedLodging.bikepackSpecs.toolKitBrand}
                          </span>
                        </div>
                        <div className="spec-block">
                          <span className="label">Carb Energy Load</span>
                          <span className="value">
                            <i className="fa-solid fa-utensils"></i> {selectedLodging.bikepackSpecs.breakfastCalories} kcal Fuel
                          </span>
                        </div>
                        <div className="spec-block">
                          <span className="label">Drivetrain Wash Station</span>
                          <span className="value">
                            {selectedLodging.bikepackSpecs.hasWashStation ? (
                              <><i className="fa-solid fa-circle-check"></i> Wash & Degrease</>
                            ) : (
                              <><i className="fa-solid fa-circle-xmark" style={{ color: 'var(--text-muted)' }}></i> N/A</>
                            )}
                          </span>
                        </div>
                        <div className="spec-block">
                          <span className="label">Wet Laundry Room</span>
                          <span className="value">
                            {selectedLodging.bikepackSpecs.hasLaundry ? (
                              <><i className="fa-solid fa-circle-check"></i> Drying Closet</>
                            ) : (
                              <><i className="fa-solid fa-circle-xmark" style={{ color: 'var(--text-muted)' }}></i> N/A</>
                            )}
                          </span>
                        </div>
                        <div className="spec-block">
                          <span className="label">Inner Tubes & Patchkits</span>
                          <span className="value">
                            {selectedLodging.bikepackSpecs.hasSparesInventory ? (
                              <><i className="fa-solid fa-circle-check"></i> Available on-site</>
                            ) : (
                              <><i className="fa-solid fa-circle-xmark" style={{ color: 'var(--text-muted)' }}></i> N/A</>
                            )}
                          </span>
                        </div>
                        <div className="spec-block">
                          <span className="label">Ride-in, Ride-out</span>
                          <span className="value">
                            <i className="fa-solid fa-route"></i> {selectedLodging.bikepackSpecs.rideInOut}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Spares List Inventory Chips */}
                    {selectedLodging.bikepackSpecs.sparesList && selectedLodging.bikepackSpecs.sparesList.length > 0 && (
                      <div className="spares-inventory-box" style={{ marginTop: '1rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available Spare Parts Inventory</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {selectedLodging.bikepackSpecs.sparesList.map((spare, idx) => (
                            <span 
                              key={idx} 
                              style={{ fontSize: '0.7rem', backgroundColor: 'rgba(163, 230, 53, 0.08)', color: 'var(--accent-lime)', border: '1px solid rgba(163, 230, 53, 0.15)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}
                            >
                              <i className="fa-solid fa-wrench" style={{ marginRight: '0.25rem', fontSize: '0.65rem' }}></i>
                              {spare}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedLodging.bikepackSpecs.accessNotes && (
                      <div style={{ margin: '0.75rem 0', padding: '0.75rem 1rem', backgroundColor: 'rgba(163, 230, 53, 0.05)', borderLeft: '3px solid var(--accent-lime)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>🚲 Route Access & Terrain</strong>
                        {selectedLodging.bikepackSpecs.accessNotes}
                      </div>
                    )}
                    
                    <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent-lime)', marginRight: '0.4rem' }}></i>
                      Spares and repair assistance are coordinated directly with the host, <strong>{selectedLodging.hostName}</strong>.
                    </div>
                  </div>
                )}
              </div>

              {/* Booking Widget Column */}
              <div className="booking-widget">
                <div className="widget-price-row">
                  <div className="widget-price">
                    ${selectedLodging.pricePerNight} <span>/ night</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Fits up to {selectedLodging.maxBikes} rigs
                  </div>
                </div>

                <form onSubmit={handleBookingSubmit} className="booking-form">
                  <div className="input-row">
                    <label>Check-In Date</label>
                    <input 
                      type="date" 
                      required 
                      className="widget-input"
                      value={bookingCheckIn}
                      onChange={(e) => setBookingCheckIn(e.target.value)}
                    />
                  </div>
                  <div className="input-row">
                    <label>Check-Out Date</label>
                    <input 
                      type="date" 
                      required 
                      className="widget-input"
                      value={bookingCheckOut}
                      onChange={(e) => setBookingCheckOut(e.target.value)}
                    />
                  </div>
                  <div className="input-row">
                    <label>Number of Rigs (Bikes)</label>
                    <input 
                      type="number" 
                      required 
                      min="1" 
                      max={selectedLodging.maxBikes}
                      className="widget-input"
                      value={bookingBikes}
                      onChange={(e) => setBookingBikes(Number(e.target.value))}
                    />
                  </div>

                  {bookingNights > 0 && (
                    <div className="price-summary">
                      <div className="summary-row">
                        <span>${selectedLodging.pricePerNight} x {bookingNights} nights</span>
                        <span>${baseBookingTotal}</span>
                      </div>
                      <div className="summary-row">
                        <span>Gear handling fee ($10/rig x {bookingNights} nights)</span>
                        <span>${bookingBikeSurcharge}</span>
                      </div>
                      <div className="summary-row total-row">
                        <span>Total</span>
                        <span>${bookingTotal}</span>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="book-btn">Request Reservation</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <i className="fa-solid fa-gear"></i>
            <span>Bikepack Boarding Inc.</span>
          </div>
          <div className="footer-links">
            <a href="#about">About</a>
            <a href="#terms">Terms</a>
            <a href="#security">Host Security</a>
            <a href="#contact">Cyclist Help</a>
          </div>
          <p className="footer-copy">&copy; {new Date().getFullYear()} Bikepack Boarding. All rights reserved. Designed for active gravel travelers.</p>
        </div>
      </footer>

      {/* Auth Modal Overlay */}
      {authModalOpen && (
        <div className="modal-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="modal-content auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAuthModalOpen(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            
            <div className="auth-form-wrapper">
              {/* Premium Tab Switcher in Auth Modal */}
              <div className="auth-modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <button 
                  type="button"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: authMode === 'login' ? '2px solid var(--accent-lime)' : 'none',
                    color: authMode === 'login' ? 'var(--accent-lime)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => { setAuthMode('login'); setAuthError(null); }}
                >
                  Sign In (로그인)
                </button>
                <button 
                  type="button"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: authMode === 'signup' ? '2px solid var(--accent-lime)' : 'none',
                    color: authMode === 'signup' ? 'var(--accent-lime)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => { setAuthMode('signup'); setAuthError(null); }}
                >
                  Sign Up (회원가입)
                </button>
              </div>
              <p className="auth-subtitle" style={{ textAlign: 'center', marginTop: '-0.5rem', marginBottom: '1rem' }}>Support local hosts & track your bikepacking basecamps</p>
              
              <form onSubmit={handleAuthSubmit} className="host-form auth-form">
                {authError && <div className="auth-error-message"><i className="fa-solid fa-triangle-exclamation"></i> {authError}</div>}
                
                <div className="input-row">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="you@example.com"
                    className="widget-input"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>
                
                <div className="input-row">
                  <label>Password</label>
                  <input 
                    type="password" 
                    required 
                    placeholder="Minimum 6 characters"
                    className="widget-input"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </div>
                
                <button type="submit" className="form-btn auth-submit-btn" disabled={authLoading}>
                  {authLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
                
                <div className="auth-toggle-text">
                  {authMode === 'login' ? (
                    <>
                      Don't have an account?{' '}
                      <span className="auth-toggle-link" onClick={() => setAuthMode('signup')}>Sign Up</span>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <span className="auth-toggle-link" onClick={() => setAuthMode('login')}>Sign In</span>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Premium Toast Notification System */}
      {toast.visible && (
        <div 
          className="premium-toast"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--accent-lime)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            color: 'var(--text-primary)',
            boxShadow: '0 8px 30px rgba(163, 230, 53, 0.25)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent-lime)', fontSize: '1.1rem' }}></i>
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;
