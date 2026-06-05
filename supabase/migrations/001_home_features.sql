-- ============================================================
-- KAMI — Home Features Migration
-- Tables: mood_logs, journal_entries, goals, daily_prompts
-- Security: RLS enabled on all tables, users only access own data
-- Performance: Indexed for all primary query patterns
-- Realtime: Enabled on mood_logs, journal_entries, goals
-- ============================================================

-- ─── Utility: auto-update updated_at ────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: mood_logs
-- One entry per user per day. Stores mood + optional note.
-- ============================================================
CREATE TABLE IF NOT EXISTS mood_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_id     TEXT        NOT NULL,          -- e.g. 'joyful', 'calm', 'anxious'
  mood_emoji  TEXT        NOT NULL,          -- emoji stored for display independence
  mood_label  TEXT        NOT NULL,
  note        TEXT,                          -- optional reflection (plain text, user controls privacy)
  logged_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, logged_date)               -- one mood per user per day
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date
  ON mood_logs(user_id, logged_date DESC);   -- feed query: latest first

ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own mood logs
CREATE POLICY "mood_logs_owner_all" ON mood_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_mood_logs_updated_at
  BEFORE UPDATE ON mood_logs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Enable realtime for live streak/mood updates
ALTER PUBLICATION supabase_realtime ADD TABLE mood_logs;

-- ============================================================
-- TABLE: journal_entries
-- Private journal. One or many entries per day.
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,                          -- optional title
  body        TEXT        NOT NULL,          -- journal content
  mood_id     TEXT,                          -- optional mood tag at time of writing
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  entry_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  is_pinned   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user_date
  ON journal_entries(user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_pinned
  ON journal_entries(user_id, is_pinned)
  WHERE is_pinned = TRUE;

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries_owner_all" ON journal_entries
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;

-- ============================================================
-- TABLE: goals
-- Personal goals with progress tracking and target dates.
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  category      TEXT        NOT NULL DEFAULT 'personal'
    CHECK (category IN ('personal', 'health', 'career', 'relationship', 'learning', 'creative', 'other')),
  status        TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  progress      SMALLINT    NOT NULL DEFAULT 0
    CHECK (progress BETWEEN 0 AND 100),      -- percentage 0–100
  target_date   DATE,                        -- optional deadline
  completed_at  TIMESTAMPTZ,
  emoji         TEXT        NOT NULL DEFAULT '🌱',
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_status
  ON goals(user_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_goals_user_active
  ON goals(user_id, created_at DESC)
  WHERE status = 'active';

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_owner_all" ON goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE goals;

-- ============================================================
-- TABLE: daily_prompts
-- Seeded prompts served to users daily (admin-managed).
-- No RLS restriction on SELECT — all users can read prompts.
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_prompts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'reflection'
    CHECK (category IN ('reflection', 'gratitude', 'growth', 'playful', 'deep')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE daily_prompts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active prompts
CREATE POLICY "daily_prompts_read_active" ON daily_prompts
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- Only service role can insert/update/delete
CREATE POLICY "daily_prompts_service_write" ON daily_prompts
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_daily_prompts_updated_at
  BEFORE UPDATE ON daily_prompts
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- TABLE: prompt_responses
-- User's responses to daily prompts.
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_prompt_responses_user_date
  ON prompt_responses(user_id, response_date DESC);

ALTER TABLE prompt_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_responses_owner_all" ON prompt_responses
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_prompt_responses_updated_at
  BEFORE UPDATE ON prompt_responses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE prompt_responses;

-- ============================================================
-- TABLE: streaks
-- Tracks daily check-in streaks per user.
-- Updated by a trigger on mood_logs insert.
-- ============================================================
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

CREATE POLICY "streaks_owner_read" ON streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "streaks_owner_update" ON streaks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER set_streaks_updated_at
  BEFORE UPDATE ON streaks
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE streaks;

-- ============================================================
-- FUNCTION + TRIGGER: Auto-update streak on mood_log insert
-- ============================================================
CREATE OR REPLACE FUNCTION update_streak_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_streak       RECORD;
  v_yesterday    DATE := CURRENT_DATE - INTERVAL '1 day';
  v_new_current  INT;
  v_new_longest  INT;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_mood_log_insert_update_streak
  AFTER INSERT ON mood_logs
  FOR EACH ROW EXECUTE FUNCTION update_streak_on_checkin();

-- ============================================================
-- SEED: Daily prompts (20 prompts across 5 categories)
-- ============================================================
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
