-- ============================================================
-- KAMI — Random Candid Feature Migration
-- Safe to run: IF NOT EXISTS on everything
-- Compatible with couple_members junction table schema
-- ============================================================


-- ─── 1. COUPLE CANDIDS TABLE ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.couple_candids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_path      TEXT NOT NULL,
  thumb_path      TEXT,
  caption         TEXT,
  reaction_emoji  TEXT,
  is_seen         BOOLEAN NOT NULL DEFAULT FALSE,
  seen_at         TIMESTAMPTZ,
  is_first_candid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- Reuse existing updated_at trigger pattern
DROP TRIGGER IF EXISTS set_couple_candids_updated_at ON public.couple_candids;
CREATE TRIGGER set_couple_candids_updated_at
  BEFORE UPDATE ON public.couple_candids
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ─── 2. COUPLE CANDID STREAKS TABLE ─────────────────────────
-- FIX: No positional user1/user2 columns — couples here use the
-- couple_members junction table. Track per-user last sent date
-- in JSONB keyed by user_id, consistent with the rest of the schema.
CREATE TABLE IF NOT EXISTS public.couple_candid_streaks (
  couple_id           UUID PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  current_streak      INTEGER NOT NULL DEFAULT 0,
  longest_streak      INTEGER NOT NULL DEFAULT 0,
  last_both_sent_date DATE,
  -- { "<user_uuid>": "YYYY-MM-DD", "<partner_uuid>": "YYYY-MM-DD" }
  last_sent_dates     JSONB NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── 3. STREAK TRIGGER (SERVER-SIDE, TAMPER-PROOF) ──────────
-- FIX: Streak logic must be SECURITY DEFINER trigger — not client-writable.
-- Mirrors the pattern used by update_streak_on_checkin() for mood logs.
CREATE OR REPLACE FUNCTION public.update_candid_streak_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_streak          RECORD;
  v_partner_id      UUID;
  v_today           DATE := CURRENT_DATE;
  v_yesterday       DATE := CURRENT_DATE - INTERVAL '1 day';
  v_partner_sent    DATE;
  v_new_last_sent   JSONB;
  v_new_current     INT;
  v_new_longest     INT;
BEGIN
  -- Resolve partner from junction table (no user1_id/user2_id columns exist)
  SELECT user_id INTO v_partner_id
  FROM public.couple_members
  WHERE couple_id = NEW.couple_id
    AND user_id != NEW.sender_id
  LIMIT 1;

  -- Ensure streak row exists
  INSERT INTO public.couple_candid_streaks (couple_id)
  VALUES (NEW.couple_id)
  ON CONFLICT (couple_id) DO NOTHING;

  SELECT * INTO v_streak
  FROM public.couple_candid_streaks
  WHERE couple_id = NEW.couple_id;

  -- Pull partner's last send date from JSONB
  v_partner_sent := (v_streak.last_sent_dates ->> v_partner_id::TEXT)::DATE;

  -- Stamp this sender's date
  v_new_last_sent := v_streak.last_sent_dates
    || jsonb_build_object(NEW.sender_id::TEXT, v_today::TEXT);

  IF v_partner_sent = v_today THEN
    -- Both sent today — evaluate streak
    IF v_streak.last_both_sent_date = v_today THEN
      -- Already counted this pair today, just update JSONB
      UPDATE public.couple_candid_streaks SET
        last_sent_dates = v_new_last_sent,
        updated_at      = NOW()
      WHERE couple_id = NEW.couple_id;
      RETURN NEW;
    ELSIF v_streak.last_both_sent_date = v_yesterday THEN
      v_new_current := v_streak.current_streak + 1;
    ELSE
      v_new_current := 1;
    END IF;

    v_new_longest := GREATEST(v_new_current, v_streak.longest_streak);

    UPDATE public.couple_candid_streaks SET
      current_streak      = v_new_current,
      longest_streak      = v_new_longest,
      last_both_sent_date = v_today,
      last_sent_dates     = v_new_last_sent,
      updated_at          = NOW()
    WHERE couple_id = NEW.couple_id;

  ELSE
    -- Partner hasn't sent today yet — just track this sender's date
    UPDATE public.couple_candid_streaks SET
      last_sent_dates = v_new_last_sent,
      updated_at      = NOW()
    WHERE couple_id = NEW.couple_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke direct execution — only fires via trigger
REVOKE ALL ON FUNCTION public.update_candid_streak_on_insert() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_candid_insert_update_streak ON public.couple_candids;
CREATE TRIGGER on_candid_insert_update_streak
  AFTER INSERT ON public.couple_candids
  FOR EACH ROW EXECUTE FUNCTION public.update_candid_streak_on_insert();


-- ─── 4. INDEXES ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_couple_candids_couple
  ON public.couple_candids(couple_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_couple_candids_sender
  ON public.couple_candids(sender_id);

-- Partial index for unseen feed (excludes soft-deleted rows)
CREATE INDEX IF NOT EXISTS idx_couple_candids_unseen
  ON public.couple_candids(couple_id)
  WHERE is_seen = FALSE AND deleted_at IS NULL;


-- ─── 5. REALTIME (SAFE — wrapped in exception handler) ───────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_candids;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_candid_streaks;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ─── 6. RLS — COUPLE CANDIDS ────────────────────────────────
-- FIX: All policies use public.is_couple_member() — NOT user1_id/user2_id
-- (those columns do not exist in the couples table).
ALTER TABLE public.couple_candids ENABLE ROW LEVEL SECURITY;

-- Both partners can view candids (soft-deleted rows still visible to allow
-- "this was deleted" UI states — filter deleted_at IS NULL in the app layer)
DROP POLICY IF EXISTS "candids_select" ON public.couple_candids;
CREATE POLICY "candids_select"
  ON public.couple_candids FOR SELECT
  USING (public.is_couple_member(couple_id));

-- Only a couple member can send, and must be the declared sender
DROP POLICY IF EXISTS "candids_insert" ON public.couple_candids;
CREATE POLICY "candids_insert"
  ON public.couple_candids FOR INSERT
  WITH CHECK (
    public.is_couple_member(couple_id)
    AND auth.uid() = sender_id
  );

-- Either partner can update (mark seen, add reaction emoji)
DROP POLICY IF EXISTS "candids_update" ON public.couple_candids;
CREATE POLICY "candids_update"
  ON public.couple_candids FOR UPDATE
  USING (public.is_couple_member(couple_id));

-- Only the original sender can hard-delete their own candid
DROP POLICY IF EXISTS "candids_delete" ON public.couple_candids;
CREATE POLICY "candids_delete"
  ON public.couple_candids FOR DELETE
  USING (
    public.is_couple_member(couple_id)
    AND auth.uid() = sender_id
  );


-- ─── 7. RLS — COUPLE CANDID STREAKS ─────────────────────────
ALTER TABLE public.couple_candid_streaks ENABLE ROW LEVEL SECURITY;

-- Read-only for clients — all writes go through the SECURITY DEFINER trigger
DROP POLICY IF EXISTS "candid_streaks_select" ON public.couple_candid_streaks;
CREATE POLICY "candid_streaks_select"
  ON public.couple_candid_streaks FOR SELECT
  USING (public.is_couple_member(couple_id));

-- No client INSERT/UPDATE policies — streak rows are created and mutated
-- exclusively by the update_candid_streak_on_insert() trigger function.


-- ─── 8. STORAGE BUCKET ──────────────────────────────────────
-- FIX: Added file_size_limit and allowed_mime_types to match other couple buckets.
-- Expected path structure: {couple_id}/{filename}
-- (folder[1] = couple_id, checked via is_couple_member for all policies)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'couple_candid_images',
  'couple_candid_images',
  FALSE,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── 9. STORAGE RLS — COUPLE CANDID IMAGES ──────────────────
-- FIX: Scoped to couple membership via is_couple_member(), not just
-- "any authenticated user" (which was the original broken policy).
-- Upload path must be: couple_candid_images/{couple_id}/{filename}

DROP POLICY IF EXISTS "Authenticated users can upload candid images" ON storage.objects;
DROP POLICY IF EXISTS "couple_candid_images_insert" ON storage.objects;
CREATE POLICY "couple_candid_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'couple_candid_images'
    AND public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Authenticated users can view candid images" ON storage.objects;
DROP POLICY IF EXISTS "couple_candid_images_select" ON storage.objects;
CREATE POLICY "couple_candid_images_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'couple_candid_images'
    AND public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Users can delete their own candid images" ON storage.objects;
DROP POLICY IF EXISTS "couple_candid_images_update" ON storage.objects;
CREATE POLICY "couple_candid_images_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'couple_candid_images'
    AND public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

-- Upload path for sender-scoped deletes: couple_candid_images/{couple_id}/{sender_id}/{filename}
-- folder[1] = couple_id (membership check), folder[2] = sender_id (ownership check)
DROP POLICY IF EXISTS "couple_candid_images_delete" ON storage.objects;
CREATE POLICY "couple_candid_images_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'couple_candid_images'
    AND public.is_couple_member(((storage.foldername(name))[1])::uuid)
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );


-- ─── 10. GRANT PERMISSIONS ───────────────────────────────────
GRANT ALL ON TABLE public.couple_candids TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.couple_candid_streaks TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_candid_streak_on_insert() TO service_role;