-- =================================================================
-- BIKAPACK BOARDING - SUPABASE DATABASE SCHEMA
-- =================================================================

-- 1. Create Lodgings Table
CREATE TABLE IF NOT EXISTS lodgings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host_name TEXT NOT NULL,
    host_avatar_url TEXT NOT NULL,
    region TEXT NOT NULL,
    country TEXT NOT NULL,
    price_per_night INT NOT NULL,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.0,
    reviews_count INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
    bikepack_specs JSONB NOT NULL,
    max_bikes INT NOT NULL DEFAULT 2,
    coordinates JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) for Lodgings
ALTER TABLE lodgings ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone (anonymous or authenticated)
CREATE POLICY "Allow public read access for lodgings" 
ON lodgings FOR SELECT 
USING (true);

-- Allow authenticated users to insert listings
CREATE POLICY "Allow authenticated users to insert lodgings" 
ON lodgings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');


-- 2. Create Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    lodging_id TEXT NOT NULL REFERENCES lodgings(id) ON DELETE CASCADE,
    lodging_name TEXT NOT NULL,
    lodging_image TEXT NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    num_bikes INT NOT NULL DEFAULT 1,
    total_price INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own bookings
CREATE POLICY "Allow users to select their own bookings" 
ON bookings FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert bookings for themselves
CREATE POLICY "Allow users to insert bookings" 
ON bookings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete/cancel their own bookings
CREATE POLICY "Allow users to delete bookings" 
ON bookings FOR DELETE 
USING (auth.uid() = user_id);


-- =================================================================
-- 3. Create Subscriptions Table (Lemon Squeezy Integration)
-- =================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lemon_squeezy_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'active', 'paused', 'cancelled', 'expired'
    variant_id VARCHAR(255) NOT NULL,
    renews_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own subscriptions
CREATE POLICY "Allow users to read own subscription" 
ON subscriptions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Trigger Function to sync metadata to auth.users on subscription update
CREATE OR REPLACE FUNCTION sync_user_subscription_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        JSONB_BUILD_OBJECT('is_subscribed', (NEW.status = 'active'))
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
CREATE OR REPLACE TRIGGER on_subscription_change
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_subscription_status();
