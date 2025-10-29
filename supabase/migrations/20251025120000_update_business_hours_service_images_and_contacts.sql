-- Migration: Update schema for business-level hours, service images, and contact fields
-- 1) Allow NULL staff assignment on appointments (assigned at confirmation)
ALTER TABLE IF EXISTS public.appointments
ALTER COLUMN staff_member_id DROP NOT NULL;

-- 2) Add photo_url to services for displaying service cards with images
ALTER TABLE IF EXISTS public.services
ADD COLUMN IF NOT EXISTS photo_url text;

-- 3) Extend business_profiles with contact and type fields
ALTER TABLE IF EXISTS public.business_profiles
ADD COLUMN IF NOT EXISTS phone_number text;

ALTER TABLE IF EXISTS public.business_profiles
ADD COLUMN IF NOT EXISTS mobile_money_number text;

ALTER TABLE IF EXISTS public.business_profiles
ADD COLUMN IF NOT EXISTS business_type text;

-- 4) Create business-level working hours table
CREATE TABLE IF NOT EXISTS public.business_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_working_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_working_hours
DO $$
BEGIN
  -- Anyone can view business working hours (for availability)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_working_hours' AND policyname = 'Anyone can view business working hours'
  ) THEN
    CREATE POLICY "Anyone can view business working hours"
      ON public.business_working_hours FOR SELECT
      TO public
      USING (true);
  END IF;

  -- Business owners can create business working hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_working_hours' AND policyname = 'Business owners can create business working hours'
  ) THEN
    CREATE POLICY "Business owners can create business working hours"
      ON public.business_working_hours FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.business_profiles bp
          WHERE bp.id = business_id AND bp.owner_id = auth.uid()
        )
      );
  END IF;

  -- Business owners can update business working hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_working_hours' AND policyname = 'Business owners can update business working hours'
  ) THEN
    CREATE POLICY "Business owners can update business working hours"
      ON public.business_working_hours FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.business_profiles bp
          WHERE bp.id = business_id AND bp.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.business_profiles bp
          WHERE bp.id = business_id AND bp.owner_id = auth.uid()
        )
      );
  END IF;

  -- Business owners can delete business working hours
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_working_hours' AND policyname = 'Business owners can delete business working hours'
  ) THEN
    CREATE POLICY "Business owners can delete business working hours"
      ON public.business_working_hours FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.business_profiles bp
          WHERE bp.id = business_id AND bp.owner_id = auth.uid()
        )
      );
  END IF;
END$$;