-- Add slug column to business_profiles for human-readable business routes
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS slug text;

-- Create a partial unique index to enforce uniqueness when slug is set
CREATE UNIQUE INDEX IF NOT EXISTS business_profiles_slug_unique
  ON public.business_profiles(slug)
  WHERE slug IS NOT NULL;