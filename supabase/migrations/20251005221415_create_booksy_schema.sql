/*
  # Booksy Clone - Complete Database Schema

  ## Overview
  This migration creates a complete booking platform database similar to Booksy.com,
  connecting clients with service providers in the health and beauty industry.

  ## New Tables

  ### 1. `profiles`
  Extended user profile information beyond Supabase auth.users
  - `id` (uuid, FK to auth.users)
  - `user_type` (text) - CLIENT, BUSINESS_OWNER, or STAFF
  - `phone_number` (text)
  - `profile_picture_url` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `business_profiles`
  Represents salons, barbershops, spas, etc.
  - `id` (uuid, PK)
  - `owner_id` (uuid, FK to profiles) - Must be BUSINESS_OWNER type
  - `name` (text) - Business name
  - `address` (text) - Street address
  - `city` (text) - City name
  - `latitude` (numeric) - For location-based search
  - `longitude` (numeric) - For location-based search
  - `description` (text) - Business description
  - `cover_photo_url` (text) - Cover image
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `services`
  Services offered by businesses (e.g., "Men's Haircut", "Manicure")
  - `id` (uuid, PK)
  - `business_id` (uuid, FK to business_profiles)
  - `name` (text) - Service name
  - `description` (text) - Service details
  - `price` (numeric) - Service price
  - `duration_minutes` (integer) - Service duration
  - `is_active` (boolean) - Can be disabled without deleting
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `staff_members`
  Links user accounts to businesses as service providers
  - `id` (uuid, PK)
  - `user_id` (uuid, FK to profiles) - Must be STAFF type
  - `business_id` (uuid, FK to business_profiles)
  - `position` (text) - Job title (e.g., "Senior Stylist")
  - `bio` (text) - Staff member bio
  - `is_active` (boolean) - Can be disabled without deleting
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `working_hours`
  Defines regular availability for staff members
  - `id` (uuid, PK)
  - `staff_member_id` (uuid, FK to staff_members)
  - `day_of_week` (integer) - 0=Sunday, 1=Monday, ..., 6=Saturday
  - `start_time` (time) - Opening time
  - `end_time` (time) - Closing time
  - `created_at` (timestamptz)

  ### 6. `appointments`
  The central table for all bookings
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to profiles) - Must be CLIENT type
  - `staff_member_id` (uuid, FK to staff_members)
  - `service_id` (uuid, FK to services)
  - `business_id` (uuid, FK to business_profiles) - Denormalized for easier queries
  - `start_time` (timestamptz) - Appointment start
  - `end_time` (timestamptz) - Appointment end
  - `status` (text) - PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW
  - `notes` (text) - Optional client notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. `reviews`
  Client feedback for completed appointments
  - `id` (uuid, PK)
  - `appointment_id` (uuid, FK to appointments)
  - `client_id` (uuid, FK to profiles)
  - `business_id` (uuid, FK to business_profiles)
  - `staff_member_id` (uuid, FK to staff_members)
  - `rating` (integer) - 1 to 5 stars
  - `comment` (text) - Optional review text
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Clients can only view/manage their own data
  - Business owners can manage their business data
  - Staff can view their schedule and business data
  - Public can search businesses and view profiles

  ## Indexes
  - Location-based search on business_profiles (latitude, longitude)
  - Appointment lookups by date and staff
  - Business and service searches
*/

-- Create enum types for better type safety
CREATE TYPE user_type AS ENUM ('CLIENT', 'BUSINESS_OWNER', 'STAFF');
CREATE TYPE appointment_status AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type user_type NOT NULL DEFAULT 'CLIENT',
  phone_number text,
  profile_picture_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Public can view basic profile info (needed for staff/business listings)
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO public
  USING (true);

-- =====================================================
-- BUSINESS PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  description text,
  cover_photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create indexes for search and location queries
CREATE INDEX IF NOT EXISTS idx_business_profiles_city ON business_profiles(city);
CREATE INDEX IF NOT EXISTS idx_business_profiles_location ON business_profiles(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_business_profiles_owner ON business_profiles(owner_id);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view business profiles (public search)
CREATE POLICY "Anyone can view business profiles"
  ON business_profiles FOR SELECT
  TO public
  USING (true);

-- Business owners can create their own business
CREATE POLICY "Business owners can create business"
  ON business_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type = 'BUSINESS_OWNER'
    )
  );

-- Business owners can update their own business
CREATE POLICY "Business owners can update own business"
  ON business_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Business owners can delete their own business
CREATE POLICY "Business owners can delete own business"
  ON business_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- =====================================================
-- SERVICES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(business_id, is_active);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Anyone can view active services
CREATE POLICY "Anyone can view services"
  ON services FOR SELECT
  TO public
  USING (true);

-- Business owners can create services for their business
CREATE POLICY "Business owners can create services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- Business owners can update their business services
CREATE POLICY "Business owners can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- Business owners can delete their business services
CREATE POLICY "Business owners can delete services"
  ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- =====================================================
-- STAFF MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  position text,
  bio text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_staff_per_business UNIQUE(user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_members_business ON staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_user ON staff_members(user_id);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Anyone can view staff members (for booking)
CREATE POLICY "Anyone can view staff members"
  ON staff_members FOR SELECT
  TO public
  USING (true);

-- Business owners can add staff to their business
CREATE POLICY "Business owners can add staff"
  ON staff_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- Business owners can update their staff
CREATE POLICY "Business owners can update staff"
  ON staff_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- Business owners can remove staff
CREATE POLICY "Business owners can delete staff"
  ON staff_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- =====================================================
-- WORKING HOURS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time),
  CONSTRAINT unique_staff_day UNIQUE(staff_member_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_working_hours_staff ON working_hours(staff_member_id);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

-- Anyone can view working hours (for availability)
CREATE POLICY "Anyone can view working hours"
  ON working_hours FOR SELECT
  TO public
  USING (true);

-- Business owners can set working hours for their staff
CREATE POLICY "Business owners can create working hours"
  ON working_hours FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members sm
      JOIN business_profiles bp ON sm.business_id = bp.id
      WHERE sm.id = staff_member_id AND bp.owner_id = auth.uid()
    )
  );

-- Business owners can update working hours
CREATE POLICY "Business owners can update working hours"
  ON working_hours FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      JOIN business_profiles bp ON sm.business_id = bp.id
      WHERE sm.id = staff_member_id AND bp.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members sm
      JOIN business_profiles bp ON sm.business_id = bp.id
      WHERE sm.id = staff_member_id AND bp.owner_id = auth.uid()
    )
  );

-- Business owners can delete working hours
CREATE POLICY "Business owners can delete working hours"
  ON working_hours FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      JOIN business_profiles bp ON sm.business_id = bp.id
      WHERE sm.id = staff_member_id AND bp.owner_id = auth.uid()
    )
  );

-- =====================================================
-- APPOINTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status appointment_status DEFAULT 'PENDING',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(staff_member_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Clients can view their own appointments
CREATE POLICY "Clients can view own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

-- Business owners can view appointments for their business
CREATE POLICY "Business owners can view business appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- Staff can view their own appointments
CREATE POLICY "Staff can view own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE id = staff_member_id AND user_id = auth.uid()
    )
  );

-- Clients can create appointments
CREATE POLICY "Clients can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type = 'CLIENT'
    )
  );

-- Clients can cancel their own appointments
CREATE POLICY "Clients can update own appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Business owners can update appointments for their business
CREATE POLICY "Business owners can update business appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_profiles
      WHERE id = business_id AND owner_id = auth.uid()
    )
  );

-- =====================================================
-- REVIEWS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_review_per_appointment UNIQUE(appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_staff ON reviews(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client ON reviews(client_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews (public)
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  TO public
  USING (true);

-- Clients can create reviews for their completed appointments
CREATE POLICY "Clients can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id AND
    EXISTS (
      SELECT 1 FROM appointments
      WHERE id = appointment_id 
      AND client_id = auth.uid() 
      AND status = 'COMPLETED'
    )
  );

-- Clients can update their own reviews
CREATE POLICY "Clients can update own reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Clients can delete their own reviews
CREATE POLICY "Clients can delete own reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = client_id);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_profiles_updated_at BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_members_updated_at BEFORE UPDATE ON staff_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_user_type text;
  final_user_type user_type := 'CLIENT';
BEGIN
  -- Read desired user_type from auth.users.raw_user_meta_data if provided
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'user_type' THEN
    meta_user_type := NEW.raw_user_meta_data->>'user_type';
    -- Safely cast only if it matches the enum
    IF meta_user_type IN ('CLIENT', 'BUSINESS_OWNER', 'STAFF') THEN
      final_user_type := meta_user_type::user_type;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, user_type, created_at, updated_at)
  VALUES (NEW.id, final_user_type, now(), now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the function runs with the correct search_path
ALTER FUNCTION public.handle_new_user() SET search_path = public;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();