-- ============================================================
-- KAMI — Unified Supabase Database Setup & Security Schema
-- Run this script in the Supabase SQL Editor to set up everything
-- ============================================================

-- ─── 1. CORE PROFILES SCHEMA & AUTO-REGISTRATION ─────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  nickname    TEXT,
  avatar_url  TEXT,
  theme       TEXT NOT NULL DEFAULT 'blush',
  text_size   TEXT NOT NULL DEFAULT 'medium',
  daily_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  streak_alerts_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  push_token  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-profile trigger function (SECURITY DEFINER with search_path set)
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

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);


-- ─── 2. UTILITIES & CORE FEATURES TABLES ─────────────────────

-- Dynamic updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- mood_logs
CREATE TABLE IF NOT EXISTS mood_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_id     TEXT        NOT NULL,
  mood_emoji  TEXT        NOT NULL,
  mood_label  TEXT        NOT NULL,
  note        TEXT,
  logged_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, logged_date)
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, logged_date DESC);
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mood_logs_owner_all" ON mood_logs;
CREATE POLICY "mood_logs_owner_all" ON mood_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_mood_logs_updated_at ON mood_logs;
CREATE TRIGGER set_mood_logs_updated_at
  BEFORE UPDATE ON mood_logs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- journal_entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  body        TEXT        NOT NULL,
  mood_id     TEXT,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  entry_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_pinned   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_pinned ON journal_entries(user_id, is_pinned) WHERE is_pinned = TRUE;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_entries_owner_all" ON journal_entries;
CREATE POLICY "journal_entries_owner_all" ON journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER set_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- goals
CREATE TABLE IF NOT EXISTS goals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  category      TEXT        NOT NULL DEFAULT 'personal' CHECK (category IN ('personal', 'health', 'career', 'relationship', 'learning', 'creative', 'other')),
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  progress      SMALLINT    NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date   DATE,
  completed_at  TIMESTAMPTZ,
  emoji         TEXT        NOT NULL DEFAULT '🌱',
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_goals_user_active ON goals(user_id, created_at DESC) WHERE status = 'active';
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_owner_all" ON goals;
CREATE POLICY "goals_owner_all" ON goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_goals_updated_at ON goals;
CREATE TRIGGER set_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- daily_prompts
CREATE TABLE IF NOT EXISTS daily_prompts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'reflection' CHECK (category IN ('reflection', 'gratitude', 'growth', 'playful', 'deep')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE daily_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_prompts_read_active" ON daily_prompts;
CREATE POLICY "daily_prompts_read_active" ON daily_prompts FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

DROP POLICY IF EXISTS "daily_prompts_service_write" ON daily_prompts;
CREATE POLICY "daily_prompts_service_write" ON daily_prompts FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS set_daily_prompts_updated_at ON daily_prompts;
CREATE TRIGGER set_daily_prompts_updated_at
  BEFORE UPDATE ON daily_prompts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- prompt_responses
CREATE TABLE IF NOT EXISTS prompt_responses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id   UUID        NOT NULL REFERENCES daily_prompts(id) ON DELETE CASCADE,
  response    TEXT        NOT NULL,
  response_date DATE      NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, prompt_id, response_date)
);

CREATE INDEX IF NOT EXISTS idx_prompt_responses_user_date ON prompt_responses(user_id, response_date DESC);
ALTER TABLE prompt_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_responses_owner_all" ON prompt_responses;
CREATE POLICY "prompt_responses_owner_all" ON prompt_responses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_prompt_responses_updated_at ON prompt_responses;
CREATE TRIGGER set_prompt_responses_updated_at
  BEFORE UPDATE ON prompt_responses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- streaks
CREATE TABLE IF NOT EXISTS streaks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak  INT         NOT NULL DEFAULT 0,
  longest_streak  INT         NOT NULL DEFAULT 0,
  last_checkin_date DATE,
  total_checkins  INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "streaks_owner_read" ON streaks;
CREATE POLICY "streaks_owner_read" ON streaks FOR SELECT USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_streaks_updated_at ON streaks;
CREATE TRIGGER set_streaks_updated_at
  BEFORE UPDATE ON streaks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ─── 3. MEMORIES & FUTURE LETTERS SCHEMA ──────────────────────

-- memories
CREATE TABLE IF NOT EXISTS memories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT,
  emoji       TEXT        NOT NULL DEFAULT '🌸',
  mood        TEXT,
  memory_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_date ON memories(user_id, memory_date DESC);
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memories_owner_all" ON memories;
CREATE POLICY "memories_owner_all" ON memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_memories_updated_at ON memories;
CREATE TRIGGER set_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- future_letters
CREATE TABLE IF NOT EXISTS future_letters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  deliver_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_future_letters_user_deliver ON future_letters(user_id, deliver_at ASC);
ALTER TABLE future_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "future_letters_owner_all" ON future_letters;
CREATE POLICY "future_letters_owner_all" ON future_letters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_future_letters_updated_at ON future_letters;
CREATE TRIGGER set_future_letters_updated_at
  BEFORE UPDATE ON future_letters
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ─── 4. SECURITY AUDITING, STORAGE BUCKETS, OPTIMIZATIONS ─────

-- Column Defaults for implicit ownership
ALTER TABLE mood_logs ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE journal_entries ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE goals ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE prompt_responses ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE memories ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE future_letters ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Hardened triggers revoke and comparison fix
CREATE OR REPLACE FUNCTION update_streak_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_streak       RECORD;
  v_yesterday    DATE;
  v_new_current  INT;
  v_new_longest  INT;
BEGIN
  -- Calculate relative to logged date to resolve timezone mismatch resets
  v_yesterday := NEW.logged_date - INTERVAL '1 day';

  INSERT INTO streaks(user_id, current_streak, longest_streak, last_checkin_date, total_checkins)
  VALUES (NEW.user_id, 1, 1, NEW.logged_date, 1)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak FROM streaks WHERE user_id = NEW.user_id;

  IF v_streak.last_checkin_date = NEW.logged_date THEN
    RETURN NEW;
  END IF;

  IF v_streak.last_checkin_date = v_yesterday THEN
    v_new_current := v_streak.current_streak + 1;
  ELSE
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

DROP TRIGGER IF EXISTS on_mood_log_insert_update_streak ON mood_logs;
CREATE TRIGGER on_mood_log_insert_update_streak
  AFTER INSERT ON mood_logs
  FOR EACH ROW EXECUTE FUNCTION update_streak_on_checkin();

-- Remove direct updates on streaks to block manual client tampering
DROP POLICY IF EXISTS "streaks_owner_update" ON streaks;

-- NOTE: Storage Buckets and policies have been separated into a dedicated script:
-- supabase_storage_setup.sql (run it separately if setting up storage buckets via SQL).

-- Add columns to schemas
ALTER TABLE memories ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE future_letters ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'blush';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS text_size TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Revoke select on body and attachments to prevent early network eavesdropping
REVOKE SELECT (body, image_urls) ON public.future_letters FROM authenticated;

-- Future letters decrypt validation function
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

-- Secure Self-Delete Account RPC
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

-- Deterministic daily prompt picker
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

-- GIN and indexing optimization
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || body)) STORED;
CREATE INDEX IF NOT EXISTS idx_journal_entries_fts ON journal_entries USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_prompt_responses_prompt_id ON prompt_responses(prompt_id);

-- Realtime Enablement
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
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE memories;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ─── Seed daily prompts if not present
INSERT INTO daily_prompts (content, category, display_order) VALUES
  ('What is one thing you''re genuinely proud of today?',          'reflection', 1),
  ('Describe a moment this week where you felt truly yourself.',    'reflection', 2),
  ('What would you tell your past self from one year ago?',         'deep',       3),
  ('Name three things that made you smile today, however small.',   'gratitude',  4),
  ('What is one habit you want to start this week?',               'growth',     5),
  ('If today had a colour, what would it be and why?',             'playful',    6),
  ('What do you need more of in your life right now?',             'deep',       7),
  ('What is something you did today that took courage?',           'reflection', 8),
  ('Write about a person who made your day a little brighter.',    'gratitude',  9),
  ('What is one thing you are looking forward to?',                'growth',     10),
  ('Describe your perfect morning in detail.',                     'playful',    11),
  ('What is holding you back from something you really want?',     'deep',       12),
  ('List five things you love about your life right now.',         'gratitude',  13),
  ('What skill do you most want to develop this year?',            'growth',     14),
  ('If you could change one thing about today, what would it be?', 'reflection', 15),
  ('What is a small act of kindness you did or witnessed today?',  'gratitude',  16),
  ('Where do you want to be in your life six months from now?',    'growth',     17),
  ('What song perfectly captures how you feel right now?',         'playful',    18),
  ('What is your biggest dream that you rarely talk about?',       'deep',       19),
  ('What are you grateful for that you often take for granted?',   'gratitude',  20)
ON CONFLICT DO NOTHING;
