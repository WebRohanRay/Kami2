-- ============================================================
-- KAMI — Unified Master Database Setup, Storage, & RLS Security
-- Run this script in the Supabase SQL Editor to initialize everything.
-- WARNING: This will drop the existing public schema and start fresh!
-- ============================================================

-- ─── 0. WIPE AND RECREATE SCHEMA ─────────────────────────────
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Grant permissions to Supabase built-in roles
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Ensure default privileges are set so future tables get correct permissions automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- ─── 1. CORE HELPER FUNCTIONS & KAMI IDS ─────────────────────
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_kami_id() 
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT;
  i INTEGER;
  is_unique BOOLEAN := FALSE;
BEGIN
  WHILE NOT is_unique LOOP
    result := 'KAMI-';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE kami_id = result) THEN
      is_unique := TRUE;
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ─── 2. CORE TABLES & USER PROFILES ─────────────────────────
CREATE TABLE public.profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   TEXT,
  nickname                TEXT,
  avatar_url              TEXT,
  theme                   TEXT NOT NULL DEFAULT 'blush',
  text_size               TEXT NOT NULL DEFAULT 'medium',
  timezone                TEXT NOT NULL DEFAULT 'UTC',
  daily_reminder_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  streak_alerts_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  push_token              TEXT,
  kami_id                 TEXT UNIQUE DEFAULT public.generate_kami_id(),
  active_space            TEXT DEFAULT 'personal' CHECK (active_space IN ('personal', 'couple')),
  current_mood_label      TEXT,
  current_mood_emoji      TEXT,
  last_seen_at            TIMESTAMPTZ,
  hero_bg_url             TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-profile trigger when auth.users is created
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- mood_logs
CREATE TABLE public.mood_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_id     TEXT NOT NULL,
  mood_emoji  TEXT NOT NULL,
  mood_label  TEXT NOT NULL,
  note        TEXT,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, logged_date)
);

CREATE TRIGGER set_mood_logs_updated_at
  BEFORE UPDATE ON mood_logs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- journal_entries
CREATE TABLE public.journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  body        TEXT NOT NULL,
  mood_id     TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  image_urls  TEXT[] NOT NULL DEFAULT '{}',
  entry_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- goals
CREATE TABLE public.goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'personal' CHECK (category IN ('personal', 'health', 'career', 'relationship', 'learning', 'creative', 'other')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  progress      SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date   DATE,
  completed_at  TIMESTAMPTZ,
  emoji         TEXT NOT NULL DEFAULT '🌱',
  image_url     TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- daily_prompts & prompt_responses
CREATE TABLE public.daily_prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'reflection' CHECK (category IN ('reflection', 'gratitude', 'growth', 'playful', 'deep')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_daily_prompts_updated_at
  BEFORE UPDATE ON daily_prompts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TABLE public.prompt_responses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id     UUID NOT NULL REFERENCES public.daily_prompts(id) ON DELETE CASCADE,
  response      TEXT NOT NULL,
  response_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, prompt_id, response_date)
);

CREATE TRIGGER set_prompt_responses_updated_at
  BEFORE UPDATE ON prompt_responses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- streaks
CREATE TABLE public.streaks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak    INT NOT NULL DEFAULT 0,
  longest_streak    INT NOT NULL DEFAULT 0,
  last_checkin_date DATE,
  total_checkins    INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_streaks_updated_at
  BEFORE UPDATE ON streaks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- memories
CREATE TABLE public.memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT,
  emoji         TEXT NOT NULL DEFAULT '🌸',
  mood          TEXT,
  image_urls    TEXT[] NOT NULL DEFAULT '{}',
  memory_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- future_letters
CREATE TABLE public.future_letters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  deliver_at    TIMESTAMPTZ NOT NULL,
  image_urls    TEXT[] NOT NULL DEFAULT '{}',
  is_draft      BOOLEAN DEFAULT FALSE,
  is_read       BOOLEAN DEFAULT FALSE,
  is_favorite   BOOLEAN DEFAULT FALSE,
  is_archived   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_future_letters_updated_at
  BEFORE UPDATE ON future_letters
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ─── 3. COUPLES & MEMBERSHIP TABLES ─────────────────────────
CREATE TABLE public.couples (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT,
  anniversary_date    DATE,
  pending_deletion    BOOLEAN DEFAULT FALSE,
  delete_at           TIMESTAMPTZ,
  creator_id          UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.couple_members (
  couple_id           UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (couple_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE public.couple_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id           UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status              TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE (sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);

-- Couple Journals, Comments, Reactions
CREATE TABLE public.couple_journals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT,
  body          TEXT NOT NULL,
  mood_id       TEXT,
  image_urls    TEXT[] DEFAULT '{}',
  tags          TEXT[] DEFAULT '{}',
  entry_date    DATE DEFAULT CURRENT_DATE,
  is_pinned     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.couple_journal_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES public.couple_journals(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.couple_journal_reactions (
  entry_id      UUID REFERENCES public.couple_journals(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (entry_id, user_id, emoji)
);

-- Couple Memories, Goals, Letters, Answers, Events
CREATE TABLE public.couple_memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  image_urls    TEXT[] DEFAULT '{}',
  memory_date   DATE DEFAULT CURRENT_DATE,
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.couple_goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT DEFAULT 'relationship',
  status        TEXT CHECK (status IN ('active', 'completed', 'paused', 'abandoned')) DEFAULT 'active',
  progress      SMALLINT CHECK (progress BETWEEN 0 AND 100) DEFAULT 0,
  target_date   DATE,
  completed_at  TIMESTAMPTZ,
  emoji         TEXT DEFAULT '🌱',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.couple_letters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  deliver_at    TIMESTAMPTZ NOT NULL,
  image_urls    TEXT[] DEFAULT '{}',
  is_draft      BOOLEAN DEFAULT FALSE,
  is_read       BOOLEAN DEFAULT FALSE,
  is_favorite   BOOLEAN DEFAULT FALSE,
  is_archived   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.couple_daily_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content       TEXT NOT NULL,
  active_date   DATE UNIQUE DEFAULT CURRENT_DATE
);

CREATE TABLE public.couple_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES public.couple_daily_questions(id) ON DELETE CASCADE,
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response      TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, couple_id, user_id)
);

CREATE TABLE public.relationship_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  event_date    DATE NOT NULL,
  event_type    TEXT CHECK (event_type IN ('anniversary', 'birthday', 'date_night', 'trip', 'other')) DEFAULT 'other',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Couple reactions tables
CREATE TABLE public.couple_letter_reactions (
  letter_id     UUID NOT NULL REFERENCES public.couple_letters(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (letter_id, user_id, emoji)
);

CREATE TABLE public.couple_memory_reactions (
  memory_id     UUID NOT NULL REFERENCES public.couple_memories(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (memory_id, user_id, emoji)
);

CREATE TABLE public.couple_goal_reactions (
  goal_id       UUID NOT NULL REFERENCES public.couple_goals(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (goal_id, user_id, emoji)
);


-- ─── 4. RLS HEARTBEAT & SECURITY FUNCTIONS ──────────────────
-- RLS helper function to check couple membership (defined with SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_couple_member(couple_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.couple_members 
    WHERE couple_members.couple_id = is_couple_member.couple_id 
      AND couple_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS helper function to check if a user is the partner of another user
CREATE OR REPLACE FUNCTION public.is_partner_of(profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.couple_members m1
    JOIN public.couple_members m2 ON m1.couple_id = m2.couple_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profile_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-reset pending_deletion if either partner queries relationship state
CREATE OR REPLACE FUNCTION public.restore_deleted_couple_space()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.pending_deletion = TRUE AND NEW.pending_deletion = FALSE THEN
    NEW.delete_at = NULL;
  ELSIF OLD.pending_deletion = FALSE AND NEW.pending_deletion = TRUE THEN
    NEW.delete_at = NOW() + INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER restore_deleted_couple_space_trigger
  BEFORE UPDATE ON public.couples
  FOR EACH ROW EXECUTE PROCEDURE public.restore_deleted_couple_space();

-- Decrypt/select sealed capsule letters RPC (for solo mode letters)
CREATE OR REPLACE FUNCTION public.fetch_unlocked_letter(p_letter_id UUID)
RETURNS TABLE (body TEXT, image_urls TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT fl.body, fl.image_urls
  FROM future_letters fl
  WHERE fl.id = p_letter_id 
    AND fl.user_id = auth.uid() 
    AND (fl.deliver_at <= NOW() OR fl.is_draft = TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.fetch_unlocked_letter(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_unlocked_letter(UUID) TO authenticated;

-- Decrypt/select sealed couple capsule letters RPC
CREATE OR REPLACE FUNCTION public.fetch_unlocked_couple_letter(p_letter_id UUID)
RETURNS TABLE (body TEXT, image_urls TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT cl.body, cl.image_urls
  FROM couple_letters cl
  WHERE cl.id = p_letter_id 
    AND public.is_couple_member(cl.couple_id) 
    AND (cl.deliver_at <= NOW() OR auth.uid() = cl.sender_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.fetch_unlocked_couple_letter(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_unlocked_couple_letter(UUID) TO authenticated;

-- Secure Atomic Accept Couple Invitation transaction handler
CREATE OR REPLACE FUNCTION public.accept_couple_invitation(
  p_invitation_id UUID,
  p_couple_name TEXT
) RETURNS UUID AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_status TEXT;
  v_couple_id UUID;
BEGIN
  -- 1. Fetch and lock invitation row
  SELECT sender_id, receiver_id, status 
  INTO v_sender_id, v_receiver_id, v_status
  FROM public.couple_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  -- 2. Validate
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found.';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is not pending.';
  END IF;

  -- Verify current user is receiver
  IF v_receiver_id != auth.uid() THEN
    RAISE EXCEPTION 'You are not the receiver of this invitation.';
  END IF;

  -- Verify not self-invitation
  IF v_sender_id = v_receiver_id THEN
    RAISE EXCEPTION 'You cannot couple with yourself.';
  END IF;

  -- 3. Insert Couple
  INSERT INTO public.couples (name) 
  VALUES (p_couple_name) 
  RETURNING id INTO v_couple_id;

  -- 4. Insert Members (unique constraint on user_id ensures no double coupling)
  INSERT INTO public.couple_members (couple_id, user_id) 
  VALUES (v_couple_id, v_sender_id), (v_couple_id, v_receiver_id);

  -- 5. Update invitation status
  UPDATE public.couple_invitations 
  SET status = 'accepted' 
  WHERE id = p_invitation_id;

  RETURN v_couple_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'One of the partners is already connected to another couple.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.accept_couple_invitation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_couple_invitation(UUID, TEXT) TO authenticated;

-- Tamper-proof streaks logic
CREATE OR REPLACE FUNCTION public.update_streak_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_streak       RECORD;
  v_yesterday    DATE;
  v_new_current  INT;
  v_new_longest  INT;
BEGIN
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

REVOKE ALL ON FUNCTION public.update_streak_on_checkin() FROM PUBLIC;

CREATE TRIGGER on_mood_log_insert_update_streak
  AFTER INSERT ON mood_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_streak_on_checkin();

-- Deterministic daily prompt picker
CREATE OR REPLACE FUNCTION public.fetch_today_prompt(p_client_date DATE DEFAULT CURRENT_DATE)
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
  
  v_day_of_year := EXTRACT(DOY FROM p_client_date)::INT;
  v_offset := v_day_of_year % v_count;
  
  RETURN QUERY
  SELECT dp.id, dp.content, dp.category
  FROM daily_prompts dp
  WHERE dp.is_active = TRUE
  ORDER BY dp.display_order ASC, dp.created_at ASC
  LIMIT 1 OFFSET v_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.fetch_today_prompt(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_today_prompt(DATE) TO authenticated;

-- Secure Self-Delete Account RPC
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS VOID AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;


-- ─── 5. ROW LEVEL SECURITY (RLS) POLICIES ───────────────────
-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Mood Logs
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mood_logs_owner_all" ON public.mood_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Journal entries (solo)
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_entries_owner_all" ON public.journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goals (solo)
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_owner_all" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily Prompts
ALTER TABLE public.daily_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_prompts_read_active" ON public.daily_prompts FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
CREATE POLICY "daily_prompts_service_write" ON public.daily_prompts FOR ALL USING (auth.role() = 'service_role');

-- Prompt Responses
ALTER TABLE public.prompt_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompt_responses_owner_all" ON public.prompt_responses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Streaks (prevent manual client updates)
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streaks_owner_read" ON public.streaks FOR SELECT USING (auth.uid() = user_id);

-- Memories (solo)
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories_owner_all" ON public.memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Future Letters (solo)
ALTER TABLE public.future_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "future_letters_owner_all" ON public.future_letters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Revoke column-level reads of letters to enforce the sealed time capsule duration constraint
REVOKE SELECT (body, image_urls) ON public.future_letters FROM authenticated;

-- Couples
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couples_select" ON public.couples FOR SELECT USING (public.is_couple_member(id) OR creator_id = auth.uid());
CREATE POLICY "couples_update" ON public.couples FOR UPDATE USING (public.is_couple_member(id));
CREATE POLICY "couples_insert" ON public.couples FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "couples_delete" ON public.couples FOR DELETE USING (public.is_couple_member(id));

-- Couple Members
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_members_select" ON public.couple_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "couple_members_insert" ON public.couple_members FOR INSERT WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.couples WHERE couples.id = couple_id AND couples.creator_id = auth.uid()));
CREATE POLICY "couple_members_delete" ON public.couple_members FOR DELETE USING (user_id = auth.uid());

-- Couple Invitations
ALTER TABLE public.couple_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_select" ON public.couple_invitations FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "invitations_insert" ON public.couple_invitations FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "invitations_update" ON public.couple_invitations FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "invitations_delete" ON public.couple_invitations FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Couple Journals
ALTER TABLE public.couple_journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_journals_all" ON public.couple_journals FOR ALL 
  USING (public.is_couple_member(couple_id)) 
  WITH CHECK (public.is_couple_member(couple_id));

-- Couple Comments & Reactions
ALTER TABLE public.couple_journal_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_comments_all" ON public.couple_journal_comments FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.couple_journals WHERE couple_journals.id = entry_id AND public.is_couple_member(couple_journals.couple_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.couple_journals WHERE couple_journals.id = entry_id AND public.is_couple_member(couple_journals.couple_id)));

ALTER TABLE public.couple_journal_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_reactions_all" ON public.couple_journal_reactions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.couple_journals WHERE couple_journals.id = entry_id AND public.is_couple_member(couple_journals.couple_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.couple_journals WHERE couple_journals.id = entry_id AND public.is_couple_member(couple_journals.couple_id)));

-- Couple Memories, Goals, Letters, Answers, Events
ALTER TABLE public.couple_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_memories_all" ON public.couple_memories FOR ALL 
  USING (public.is_couple_member(couple_id)) 
  WITH CHECK (public.is_couple_member(couple_id));

ALTER TABLE public.couple_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_goals_all" ON public.couple_goals FOR ALL 
  USING (public.is_couple_member(couple_id)) 
  WITH CHECK (public.is_couple_member(couple_id));

ALTER TABLE public.couple_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_letters_insert" ON public.couple_letters FOR INSERT WITH CHECK (public.is_couple_member(couple_id) AND auth.uid() = sender_id);
CREATE POLICY "couple_letters_select" ON public.couple_letters FOR SELECT USING (public.is_couple_member(couple_id));
CREATE POLICY "couple_letters_update" ON public.couple_letters FOR UPDATE USING (public.is_couple_member(couple_id));
CREATE POLICY "couple_letters_delete" ON public.couple_letters FOR DELETE USING (public.is_couple_member(couple_id) AND auth.uid() = sender_id);
-- Revoke column-level reads of letters to enforce the sealed time capsule duration constraint
REVOKE SELECT (body, image_urls) ON public.couple_letters FROM authenticated;

ALTER TABLE public.couple_daily_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_questions_select" ON public.couple_daily_questions FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.couple_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_answers_select" ON public.couple_answers FOR SELECT USING (public.is_couple_member(couple_id));
CREATE POLICY "couple_answers_insert" ON public.couple_answers FOR INSERT WITH CHECK (public.is_couple_member(couple_id) AND auth.uid() = user_id);
CREATE POLICY "couple_answers_update" ON public.couple_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "couple_answers_delete" ON public.couple_answers FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.relationship_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relationship_events_all" ON public.relationship_events FOR ALL 
  USING (public.is_couple_member(couple_id)) 
  WITH CHECK (public.is_couple_member(couple_id));

-- Couple Letter, Memory, and Goal Reactions RLS
ALTER TABLE public.couple_letter_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_letter_reactions_all" ON public.couple_letter_reactions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.couple_letters WHERE couple_letters.id = letter_id AND public.is_couple_member(couple_letters.couple_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.couple_letters WHERE couple_letters.id = letter_id AND public.is_couple_member(couple_letters.couple_id)));

ALTER TABLE public.couple_memory_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_memory_reactions_all" ON public.couple_memory_reactions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.couple_memories WHERE couple_memories.id = memory_id AND public.is_couple_member(couple_memories.couple_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.couple_memories WHERE couple_memories.id = memory_id AND public.is_couple_member(couple_memories.couple_id)));

ALTER TABLE public.couple_goal_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couple_goal_reactions_all" ON public.couple_goal_reactions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.couple_goals WHERE couple_goals.id = goal_id AND public.is_couple_member(couple_goals.couple_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.couple_goals WHERE couple_goals.id = goal_id AND public.is_couple_member(couple_goals.couple_id)));


-- ─── 6. STORAGE BUCKETS & STORAGE POLICIES ─────────────────
-- Run insertion of buckets (Note: storage schema is separate, so this runs safely)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('journal_images', 'journal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('letter_images', 'letter_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('memory_images', 'memory_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('goal_images', 'goal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('couple_journal_images', 'couple_journal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('couple_letter_images', 'couple_letter_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('couple_memory_images', 'couple_memory_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic']),
  ('couple_goal_images', 'couple_goal_images', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage security policies
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own avatar" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_partner_of(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Journal storage policies
CREATE POLICY "Users can read own journal images" ON storage.objects FOR SELECT USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own journal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own journal images" ON storage.objects FOR UPDATE USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own journal images" ON storage.objects FOR DELETE USING (bucket_id = 'journal_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Letters storage policies
CREATE POLICY "Users can read own letter images" ON storage.objects FOR SELECT USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own letter images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own letter images" ON storage.objects FOR UPDATE USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own letter images" ON storage.objects FOR DELETE USING (bucket_id = 'letter_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Memories storage policies
CREATE POLICY "Users can read own memory images" ON storage.objects FOR SELECT USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own memory images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own memory images" ON storage.objects FOR UPDATE USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own memory images" ON storage.objects FOR DELETE USING (bucket_id = 'memory_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Goals storage policies
CREATE POLICY "Users can read own goal images" ON storage.objects FOR SELECT USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can insert own goal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own goal images" ON storage.objects FOR UPDATE USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own goal images" ON storage.objects FOR DELETE USING (bucket_id = 'goal_images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Couple Journal storage policies
CREATE POLICY "Users can read couple journal images" ON storage.objects FOR SELECT USING (bucket_id = 'couple_journal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can insert couple journal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'couple_journal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can update couple journal images" ON storage.objects FOR UPDATE USING (bucket_id = 'couple_journal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can delete couple journal images" ON storage.objects FOR DELETE USING (bucket_id = 'couple_journal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));

-- Couple Letters storage policies
CREATE POLICY "Users can read couple letter images" ON storage.objects FOR SELECT USING (bucket_id = 'couple_letter_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can insert couple letter images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'couple_letter_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can update couple letter images" ON storage.objects FOR UPDATE USING (bucket_id = 'couple_letter_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can delete couple letter images" ON storage.objects FOR DELETE USING (bucket_id = 'couple_letter_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));

-- Couple Memories storage policies
CREATE POLICY "Users can read couple memory images" ON storage.objects FOR SELECT USING (bucket_id = 'couple_memory_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can insert couple memory images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'couple_memory_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can update couple memory images" ON storage.objects FOR UPDATE USING (bucket_id = 'couple_memory_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can delete couple memory images" ON storage.objects FOR DELETE USING (bucket_id = 'couple_memory_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));

-- Couple Goals storage policies
CREATE POLICY "Users can read couple goal images" ON storage.objects FOR SELECT USING (bucket_id = 'couple_goal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can insert couple goal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'couple_goal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can update couple goal images" ON storage.objects FOR UPDATE USING (bucket_id = 'couple_goal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "Users can delete couple goal images" ON storage.objects FOR DELETE USING (bucket_id = 'couple_goal_images' AND public.is_couple_member(((storage.foldername(name))[1])::uuid));


-- ─── 7. GIN SEARCH INDEXES & OPTIMIZATIONS ──────────────────
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || body)) STORED;
CREATE INDEX IF NOT EXISTS idx_journal_entries_fts ON journal_entries USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_prompt_responses_prompt_id ON prompt_responses(prompt_id);
CREATE INDEX IF NOT EXISTS idx_future_letters_user_deliver ON future_letters(user_id, deliver_at ASC);
CREATE INDEX IF NOT EXISTS idx_memories_user_date ON memories(user_id, memory_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user_date ON journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, logged_date DESC);

-- Unique performance indexes for couple feature lookups
CREATE INDEX IF NOT EXISTS idx_couple_members_user ON couple_members(user_id);
CREATE INDEX IF NOT EXISTS idx_couple_letters_couple_deliver ON couple_letters(couple_id, deliver_at ASC);
CREATE INDEX IF NOT EXISTS idx_couple_journals_couple_date ON couple_journals(couple_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_couple_memories_couple_date ON couple_memories(couple_id, memory_date DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_events_couple_date ON relationship_events(couple_id, event_date ASC);
CREATE INDEX IF NOT EXISTS idx_couple_journal_comments_entry ON couple_journal_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_couple_journal_reactions_entry ON couple_journal_reactions(entry_id);
CREATE INDEX IF NOT EXISTS idx_couple_letter_reactions_letter ON couple_letter_reactions(letter_id);
CREATE INDEX IF NOT EXISTS idx_couple_memory_reactions_memory ON couple_memory_reactions(memory_id);
CREATE INDEX IF NOT EXISTS idx_couple_goal_reactions_goal ON couple_goal_reactions(goal_id);


-- ─── 8. REALTIME REPLICATION ENABLEMENT ─────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

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

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_journals;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_journal_comments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_journal_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_memories;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_goals;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_letters;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_answers;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE relationship_events;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_invitations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_letter_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_memory_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE couple_goal_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ─── 9. SEED DATA ───────────────────────────────────────────
-- Seed Core Daily reflection Prompts
INSERT INTO public.daily_prompts (content, category, display_order) VALUES
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

-- Seed Couple Space Daily Questions
INSERT INTO public.couple_daily_questions (content, active_date) VALUES
  ('What is a small gesture your partner did recently that made you feel loved?', CURRENT_DATE),
  ('If we could travel anywhere next weekend, where would you choose?', CURRENT_DATE + 1),
  ('What is a strength in our relationship that you appreciate the most?', CURRENT_DATE + 2),
  ('What is your favorite memory of us from this past month?', CURRENT_DATE + 3),
  ('Name one way your partner supported you this week.', CURRENT_DATE + 4),
  ('What is a goal or dream you hope we can accomplish together next year?', CURRENT_DATE + 5),
  ('Which movie, song, or hobby do you think represents us the best?', CURRENT_DATE + 6)
ON CONFLICT DO NOTHING;

-- Grant explicit permissions on all created tables, sequences, and functions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
