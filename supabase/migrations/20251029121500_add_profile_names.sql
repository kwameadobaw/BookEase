-- Add first_name and last_name to profiles, and update trigger to populate from auth metadata

-- 1) Add columns if they don't exist
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- 2) Replace handle_new_user trigger function to also capture names
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta_user_type text;
  final_user_type user_type := 'CLIENT';
  meta_first_name text;
  meta_last_name text;
BEGIN
  -- Read desired user_type from auth.users.raw_user_meta_data if provided
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'user_type' THEN
    meta_user_type := NEW.raw_user_meta_data->>'user_type';
    -- Safely cast only if it matches the enum
    IF meta_user_type IN ('CLIENT', 'BUSINESS_OWNER', 'STAFF') THEN
      final_user_type := meta_user_type::user_type;
    END IF;
  END IF;

  -- Read optional first/last name from metadata
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'first_name' THEN
    meta_first_name := NULLIF(trim(NEW.raw_user_meta_data->>'first_name'), '');
  END IF;
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'last_name' THEN
    meta_last_name := NULLIF(trim(NEW.raw_user_meta_data->>'last_name'), '');
  END IF;

  INSERT INTO public.profiles (id, user_type, first_name, last_name, created_at, updated_at)
  VALUES (NEW.id, final_user_type, meta_first_name, meta_last_name, now(), now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the function runs with the correct search_path
ALTER FUNCTION public.handle_new_user() SET search_path = public;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;