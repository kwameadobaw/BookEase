-- Add staff name and business email; relax staff_members.user_id; fix appointments policy; ensure storage bucket

-- 1) Allow nullable user_id on staff_members and add a partial unique index
ALTER TABLE IF EXISTS public.staff_members
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop old unique constraint if present and replace with partial unique index
ALTER TABLE IF EXISTS public.staff_members
  DROP CONSTRAINT IF EXISTS unique_staff_per_business;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_unique_user_per_business
  ON public.staff_members(user_id, business_id)
  WHERE user_id IS NOT NULL;

-- 2) Add a human-readable staff name
ALTER TABLE IF EXISTS public.staff_members
  ADD COLUMN IF NOT EXISTS name text;

-- 3) Add business email to business_profiles
ALTER TABLE IF EXISTS public.business_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 4) Allow both CLIENT and BUSINESS_OWNER users to create appointments
DROP POLICY IF EXISTS "Clients can create appointments" ON public.appointments;

DROP POLICY IF EXISTS "Authenticated users can create appointments" ON public.appointments;

CREATE POLICY "Authenticated users can create appointments"
  ON public.appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.user_type IN ('CLIENT','BUSINESS_OWNER')
    )
  );

-- 5) Ensure storage bucket for business/staff images exists with public-read and owner-managed writes
-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
SELECT 'business-assets', 'business-assets', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'business-assets');

-- Public read access to images (drop then create to avoid IF NOT EXISTS)
DROP POLICY IF EXISTS "Public can read business-assets" ON storage.objects;
CREATE POLICY "Public can read business-assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-assets');

-- Authenticated users can upload to business-assets
DROP POLICY IF EXISTS "Authenticated can upload to business-assets" ON storage.objects;
CREATE POLICY "Authenticated can upload to business-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'business-assets' AND owner = auth.uid());

DROP POLICY IF EXISTS "Authenticated can update own business-assets" ON storage.objects;
CREATE POLICY "Authenticated can update own business-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'business-assets' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'business-assets' AND owner = auth.uid());

DROP POLICY IF EXISTS "Authenticated can delete own business-assets" ON storage.objects;
CREATE POLICY "Authenticated can delete own business-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'business-assets' AND owner = auth.uid());