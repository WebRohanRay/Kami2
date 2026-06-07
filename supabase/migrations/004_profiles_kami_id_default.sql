-- Ensure public.generate_kami_id() exists
CREATE OR REPLACE FUNCTION public.generate_kami_id() 
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'KAMI-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Alter profiles table to set the DEFAULT constraint on kami_id
ALTER TABLE public.profiles ALTER COLUMN kami_id SET DEFAULT public.generate_kami_id();

-- Automatically backfill any existing profiles with NULL kami_ids with a unique ID
UPDATE public.profiles SET kami_id = public.generate_kami_id() WHERE kami_id IS NULL;
