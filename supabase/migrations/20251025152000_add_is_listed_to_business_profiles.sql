-- Add is_listed column to business_profiles for listing control
ALTER TABLE IF EXISTS public.business_profiles
ADD COLUMN IF NOT EXISTS is_listed boolean;

-- Backfill existing rows to listed by default
UPDATE public.business_profiles SET is_listed = true WHERE is_listed IS NULL;

-- Optional: set default for future inserts
ALTER TABLE IF EXISTS public.business_profiles
ALTER COLUMN is_listed SET DEFAULT true;