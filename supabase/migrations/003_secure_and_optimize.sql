-- ============================================================
-- KAMI — Database Security, Optimization, and Schema Update
-- ============================================================

-- ─── 1. COLUMN DEFAULTS FOR user_id ─────────────────────────
-- Sets user_id default to auth.uid() for implicit ownership
ALTER TABLE mood_logs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE journal_entries ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE goals ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE prompt_responses ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE memories ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE future_letters ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ─── 2. HARDEN TRIGGER FUNCTIONS (search_path) ──────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke public execution to ensure execution only by database triggers
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ─── 3. TIMEZONE-SAFE STREAK CALCULATIONS ───────────────────
CREATE OR REPLACE FUNCTION update_streak_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_streak       RECORD;
  v_yesterday    DATE;
  v_new_current  INT;
  v_new_longest  INT;
BEGIN
  -- Calculate yesterday based on the check-in date rather than the database server clock
  v_yesterday := NEW.logged_date - INTERVAL '1 day';

  -- Upsert streak record for this user
  INSERT INTO streaks(user_id, current_streak, longest_streak, last_checkin_date, total_checkins)
  VALUES (NEW.user_id, 1, 1, NEW.logged_date, 1)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak FROM streaks WHERE user_id = NEW.user_id;

  -- Already checked in today — no change needed
  IF v_streak.last_checkin_date = NEW.logged_date THEN
    RETURN NEW;
  END IF;

  -- Consecutive day — increment streak
  IF v_streak.last_checkin_date = v_yesterday THEN
    v_new_current := v_streak.current_streak + 1;
  ELSE
    -- Gap — reset streak
    v_new_current := 1;
  END IF;

  v_new_longest := GREATEST(v_new_current, v_streak.longest_streak);

  UPDATE streaks SET
    current_streak    = v_new_current,
    longest_streak    = v_new_longest,
    last_checkin_date = NEW.logged_date,
    total_checkins    = v_streak.total_checkins + 1
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION update_streak_on_checkin() FROM PUBLIC;

-- Remove dangerous direct UPDATE client policy on streaks
DROP POLICY IF EXISTS "streaks_owner_update" ON streaks;

-- ─── 4. STORAGE BUCKETS CONFIGURATION ──────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('journal_images', 'journal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('letter_images', 'letter_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('memory_images', 'memory_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('goal_images', 'goal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Update size/mime limit for existing avatars bucket
UPDATE storage.buckets 
SET 
  file_size_limit = 5242880, 
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/heic'] 
WHERE id = 'avatars';

-- Enable delete policy for avatars bucket
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add policies for new buckets
DROP POLICY IF EXISTS "Users can read own journal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own journal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own journal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own journal images" ON storage.objects;

CREATE POLICY "Users can read own journal images" ON storage.objects FOR SELECT
  USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own journal images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own journal images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own journal images" ON storage.objects FOR DELETE
  USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can read own letter images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own letter images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own letter images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own letter images" ON storage.objects;

CREATE POLICY "Users can read own letter images" ON storage.objects FOR SELECT
  USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own letter images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own letter images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own letter images" ON storage.objects FOR DELETE
  USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can read own memory images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own memory images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own memory images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own memory images" ON storage.objects;

CREATE POLICY "Users can read own memory images" ON storage.objects FOR SELECT
  USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own memory images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own memory images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own memory images" ON storage.objects FOR DELETE
  USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can read own goal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own goal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own goal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own goal images" ON storage.objects;

CREATE POLICY "Users can read own goal images" ON storage.objects FOR SELECT
  USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own goal images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own goal images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own goal images" ON storage.objects FOR DELETE
  USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── 5. SCHEMA EXPANSION FOR TABLES ─────────────────────────
ALTER TABLE memories ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add preferences columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'blush';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS text_size TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── 6. SECURE REACTION FOR SEALED LETTERS ───────────────────
-- Revoke select on body and attachments to prevent early network eavesdropping
REVOKE SELECT (body, image_urls) ON public.future_letters FROM authenticated;

CREATE OR REPLACE FUNCTION fetch_unlocked_letter(p_letter_id UUID)
RETURNS TABLE (body TEXT, image_urls TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT fl.body, fl.image_urls
  FROM future_letters fl
  WHERE fl.id = p_letter_id 
    AND fl.user_id = auth.uid() 
    AND fl.deliver_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION fetch_unlocked_letter(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fetch_unlocked_letter(UUID) TO authenticated;

-- ─── 7. SECURE SELF-DELETE ACCOUNT RPC ──────────────────────
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS VOID AS $$
BEGIN
  DELETE FROM storage.objects WHERE owner = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- Check if email exists RPC (used during signup validation)
CREATE OR REPLACE FUNCTION check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION check_email_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO anon, authenticated;

-- ─── 8. DETERMINISTIC PROMPT PICKER ────────────────────────
CREATE OR REPLACE FUNCTION fetch_today_prompt()
RETURNS TABLE (id UUID, content TEXT, category TEXT) AS $$
DECLARE
  v_count INT;
  v_day_of_year INT;
  v_offset INT;
BEGIN
  SELECT COUNT(*)::INT INTO v_count FROM daily_prompts WHERE is_active = TRUE;
  IF v_count = 0 THEN
    RETURN;
  END IF;
  
  v_day_of_year := EXTRACT(DOY FROM NOW())::INT;
  v_offset := v_day_of_year % v_count;
  
  RETURN QUERY
  SELECT dp.id, dp.content, dp.category
  FROM daily_prompts dp
  WHERE dp.is_active = TRUE
  ORDER BY dp.display_order ASC, dp.created_at ASC
  LIMIT 1 OFFSET v_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION fetch_today_prompt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fetch_today_prompt() TO authenticated;

-- ─── 9. PERFORMANCE INDEXING ────────────────────────────────
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || body)) STORED;
CREATE INDEX IF NOT EXISTS idx_journal_entries_fts ON journal_entries USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_prompt_responses_prompt_id ON prompt_responses(prompt_id);

-- ─── 10. REALTIME ENABLEMENT ────────────────────────────────
-- Add tables to realtime publication if they are not already present
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mood_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE goals;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE streaks;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE prompt_responses;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE future_letters;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
