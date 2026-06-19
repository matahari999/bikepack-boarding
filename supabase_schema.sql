-- =================================================================
-- BIKAPACK BOARDING - SUPABASE DATABASE SCHEMA (IDEMPOTENT & SAFE)
-- =================================================================

-- 1. Clean up existing Triggers and Functions
DROP TRIGGER IF EXISTS on_subscription_change ON public.subscriptions;
DROP TRIGGER IF EXISTS trigger_sync_subscription ON public.subscriptions;
DROP FUNCTION IF EXISTS public.sync_user_subscription_status();

-- 2. Clean up existing Policies to prevent "already exists" errors
DROP POLICY IF EXISTS "Allow public read access for lodgings" ON public.lodgings;
DROP POLICY IF EXISTS "Allow public read stays" ON public.lodgings;
DROP POLICY IF EXISTS "Allow authenticated users to insert lodgings" ON public.lodgings;
DROP POLICY IF EXISTS "Allow auth hosts to insert stays" ON public.lodgings;
DROP POLICY IF EXISTS "Allow users to select their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow users to insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow users to delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can manage their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow users to read own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.subscriptions;

-- 3. Create Lodgings Table
-- Note: id is TEXT to match Javascript sample keys like 'lodging-1', 'lodging-2'
CREATE TABLE IF NOT EXISTS public.lodgings (
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
    bikepack_specs JSONB NOT NULL DEFAULT '{}'::jsonb,
    max_bikes INT NOT NULL DEFAULT 2,
    coordinates JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) for Lodgings
ALTER TABLE public.lodgings ENABLE ROW LEVEL SECURITY;

-- Allow read access to anyone (anonymous or authenticated)
CREATE POLICY "Allow public read access for lodgings" 
ON public.lodgings FOR SELECT 
TO public
USING (true);

-- Allow authenticated users to insert listings
CREATE POLICY "Allow authenticated users to insert lodgings" 
ON public.lodgings FOR INSERT 
TO authenticated
WITH CHECK (auth.role() = 'authenticated');


-- 4. Create Bookings Table
-- Note: id and lodging_id are TEXT for seamless localStorage/Mock syncing
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    lodging_id TEXT NOT NULL REFERENCES public.lodgings(id) ON DELETE CASCADE,
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
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own bookings
CREATE POLICY "Allow users to select their own bookings" 
ON public.bookings FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert bookings for themselves
CREATE POLICY "Allow users to insert bookings" 
ON public.bookings FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete/cancel their own bookings
CREATE POLICY "Allow users to delete bookings" 
ON public.bookings FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);


-- 5. Create Subscriptions Table (Lemon Squeezy Integration)
CREATE TABLE IF NOT EXISTS public.subscriptions (
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
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own subscriptions
CREATE POLICY "Allow users to read own subscription" 
ON public.subscriptions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);


-- 6. Trigger Function to sync metadata to auth.users on subscription update
CREATE OR REPLACE FUNCTION public.sync_user_subscription_status()
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
CREATE TRIGGER on_subscription_change
    AFTER INSERT OR UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_subscription_status();
