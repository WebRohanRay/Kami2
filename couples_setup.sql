-- ============================================================
-- KAMI — Couple Space Database Schema & Security setup
-- Run this script in the Supabase SQL Editor to set up everything
-- ============================================================

-- ─── 1. UNIQUE KAMI SHORT IDS FOR PROFILES ───────────────────
CREATE OR REPLACE FUNCTION generate_kami_id() 
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

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kami_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_space TEXT DEFAULT 'personal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_mood_label TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_mood_emoji TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Apply default and check constraints safely
ALTER TABLE public.profiles ALTER COLUMN active_space SET DEFAULT 'personal';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_active_space_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_active_space_check CHECK (active_space IN ('personal', 'couple'));

-- Update existing profiles that might have null kami_ids with unique values
UPDATE public.profiles SET kami_id = generate_kami_id() WHERE kami_id IS NULL;

-- Apply unique constraint to kami_id safely
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_kami_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_kami_id_key UNIQUE (kami_id);


-- ─── 2. COUPLES & MEMBERSHIP ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.couples (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT, -- e.g. "Rohan & Priya"
  anniversary_date    DATE,
  pending_deletion    BOOLEAN DEFAULT FALSE,
  delete_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.couple_members (
  couple_id           UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (couple_id, user_id),
  UNIQUE (user_id) -- A user can belong to at most one couple
);

-- Enable RLS for couples metadata & membership tables
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Couples policies
DROP POLICY IF EXISTS "couples_select" ON public.couples;
CREATE POLICY "couples_select" ON public.couples FOR SELECT USING (public.is_couple_member(id) OR creator_id = auth.uid());

DROP POLICY IF EXISTS "couples_update" ON public.couples;
CREATE POLICY "couples_update" ON public.couples FOR UPDATE USING (public.is_couple_member(id));

DROP POLICY IF EXISTS "couples_insert" ON public.couples;
CREATE POLICY "couples_insert" ON public.couples FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "couples_delete" ON public.couples;
CREATE POLICY "couples_delete" ON public.couples FOR DELETE USING (public.is_couple_member(id));

-- Couple members policies (use a flat SELECT policy to avoid recursion loops)
DROP POLICY IF EXISTS "couple_members_select" ON public.couple_members;
CREATE POLICY "couple_members_select" ON public.couple_members FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "couple_members_insert" ON public.couple_members;
CREATE POLICY "couple_members_insert" ON public.couple_members FOR INSERT WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.couples WHERE couples.id = couple_id AND couples.creator_id = auth.uid()));

DROP POLICY IF EXISTS "couple_members_delete" ON public.couple_members;
CREATE POLICY "couple_members_delete" ON public.couple_members FOR DELETE USING (user_id = auth.uid());

-- Update profiles RLS to allow authenticated profile reads
DROP POLICY IF EXISTS "Users can view partner profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 3. INVITATIONS SYSTEM ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.couple_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id           UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status              TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE (sender_id, receiver_id)
);

ALTER TABLE public.couple_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_access" ON public.couple_invitations;
CREATE POLICY "invitations_access" ON public.couple_invitations
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);


-- ─── 4. SHARED RELATIONSHIP DATA ──────────────────────────────

-- Couple Journals
CREATE TABLE IF NOT EXISTS public.couple_journals (
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

ALTER TABLE public.couple_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_journals_access" ON public.couple_journals;
CREATE POLICY "couple_journals_access" ON public.couple_journals
  FOR ALL USING (public.is_couple_member(couple_id));

-- Comments & Reactions
CREATE TABLE IF NOT EXISTS public.couple_journal_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID NOT NULL REFERENCES public.couple_journals(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.couple_journal_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_comments_access" ON public.couple_journal_comments;
CREATE POLICY "couple_comments_access" ON public.couple_journal_comments
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.couple_journals 
    WHERE couple_journals.id = entry_id AND public.is_couple_member(couple_journals.couple_id)
  ));

CREATE TABLE IF NOT EXISTS public.couple_journal_reactions (
  entry_id      UUID REFERENCES public.couple_journals(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (entry_id, user_id, emoji)
);

ALTER TABLE public.couple_journal_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_reactions_access" ON public.couple_journal_reactions;
CREATE POLICY "couple_reactions_access" ON public.couple_journal_reactions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.couple_journals 
    WHERE couple_journals.id = entry_id AND public.is_couple_member(couple_journals.couple_id)
  ));

-- Shared Memory Timeline
CREATE TABLE IF NOT EXISTS public.couple_memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  image_urls    TEXT[] DEFAULT '{}',
  memory_date   DATE DEFAULT CURRENT_DATE,
  tags          TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.couple_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_memories_access" ON public.couple_memories;
CREATE POLICY "couple_memories_access" ON public.couple_memories
  FOR ALL USING (public.is_couple_member(couple_id));

-- Couple Goals
CREATE TABLE IF NOT EXISTS public.couple_goals (
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

ALTER TABLE public.couple_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_goals_access" ON public.couple_goals;
CREATE POLICY "couple_goals_access" ON public.couple_goals
  FOR ALL USING (public.is_couple_member(couple_id));

-- Love Letter Capsules
CREATE TABLE IF NOT EXISTS public.couple_letters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  deliver_at    TIMESTAMPTZ NOT NULL,
  image_urls    TEXT[] DEFAULT '{}',
  is_unlocked   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.couple_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_letters_insert" ON public.couple_letters;
CREATE POLICY "couple_letters_insert" ON public.couple_letters
  FOR INSERT WITH CHECK (public.is_couple_member(couple_id) AND auth.uid() = sender_id);

DROP POLICY IF EXISTS "couple_letters_select" ON public.couple_letters;
CREATE POLICY "couple_letters_select" ON public.couple_letters
  FOR SELECT USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "couple_letters_delete" ON public.couple_letters;
CREATE POLICY "couple_letters_delete" ON public.couple_letters
  FOR DELETE USING (public.is_couple_member(couple_id) AND auth.uid() = sender_id);

REVOKE SELECT (body, image_urls) ON public.couple_letters FROM authenticated;


-- Shared Daily Questions
CREATE TABLE IF NOT EXISTS public.couple_daily_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content       TEXT NOT NULL,
  active_date   DATE UNIQUE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.couple_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES public.couple_daily_questions(id) ON DELETE CASCADE,
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response      TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, couple_id, user_id)
);

ALTER TABLE public.couple_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_answers_access" ON public.couple_answers;
CREATE POLICY "couple_answers_access" ON public.couple_answers
  FOR ALL USING (public.is_couple_member(couple_id));

-- Shared Calendar (Events)
CREATE TABLE IF NOT EXISTS public.relationship_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  event_date    DATE NOT NULL,
  event_type    TEXT CHECK (event_type IN ('anniversary', 'birthday', 'date_night', 'trip', 'other')) DEFAULT 'other',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.relationship_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relationship_events_access" ON public.relationship_events;
CREATE POLICY "relationship_events_access" ON public.relationship_events
  FOR ALL USING (public.is_couple_member(couple_id));


-- ─── 5. AUTOMATIC TRIGGER FOR DELETION RECOVERY ──────────────
-- Trigger to auto-reset pending_deletion if either partner queries relationship state
CREATE OR REPLACE FUNCTION restore_deleted_couple_space()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.pending_deletion = TRUE AND NEW.pending_deletion = TRUE THEN
    -- If there's active reading from a member, restore
    UPDATE public.couples 
    SET pending_deletion = FALSE, delete_at = NULL 
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Decrypt/select sealed couple letters RPC
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

-- Letter read status & favorites extensions
ALTER TABLE public.couple_letters ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.couple_letters ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

ALTER TABLE public.future_letters ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.future_letters ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Update RLS policies to allow updating letters
DROP POLICY IF EXISTS "couple_letters_update" ON public.couple_letters;
CREATE POLICY "couple_letters_update" ON public.couple_letters
  FOR UPDATE USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "future_letters_update" ON public.future_letters;
CREATE POLICY "future_letters_update" ON public.future_letters
  FOR UPDATE USING (auth.uid() = user_id);
-- Create couple letter reactions table
CREATE TABLE IF NOT EXISTS public.couple_letter_reactions (
  letter_id     UUID REFERENCES public.couple_letters(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (letter_id, user_id, emoji)
);
ALTER TABLE public.couple_letter_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "couple_letter_reactions_access" ON public.couple_letter_reactions;
CREATE POLICY "couple_letter_reactions_access" ON public.couple_letter_reactions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.couple_letters 
    WHERE couple_letters.id = letter_id AND public.is_couple_member(couple_letters.couple_id)
  ));

-- Create couple memory reactions table
CREATE TABLE IF NOT EXISTS public.couple_memory_reactions (
  memory_id     UUID REFERENCES public.couple_memories(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (memory_id, user_id, emoji)
);
ALTER TABLE public.couple_memory_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "couple_memory_reactions_access" ON public.couple_memory_reactions;
CREATE POLICY "couple_memory_reactions_access" ON public.couple_memory_reactions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.couple_memories 
    WHERE couple_memories.id = memory_id AND public.is_couple_member(couple_memories.couple_id)
  ));

-- Create couple goal reactions table
CREATE TABLE IF NOT EXISTS public.couple_goal_reactions (
  goal_id       UUID REFERENCES public.couple_goals(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  PRIMARY KEY (goal_id, user_id, emoji)
);
ALTER TABLE public.couple_goal_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "couple_goal_reactions_access" ON public.couple_goal_reactions;
CREATE POLICY "couple_goal_reactions_access" ON public.couple_goal_reactions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.couple_goals 
    WHERE couple_goals.id = goal_id AND public.is_couple_member(couple_goals.couple_id)
  ));

-- Add columns for drafts & archive support on letters
ALTER TABLE public.couple_letters ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;
ALTER TABLE public.couple_letters ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.future_letters ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;
ALTER TABLE public.future_letters ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
