-- Add photo_url to staff_members so business owners can manage staff photos
ALTER TABLE IF EXISTS public.staff_members
ADD COLUMN IF NOT EXISTS photo_url text;

-- No policy changes required; existing staff_members RLS allows owners to update their staff rows.