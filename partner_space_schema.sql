-- ============================================================
-- KAMI — Partner Space Database Schema & Security Setup
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- ─── 1. PARTNER SPACES (one per couple) ──────────────────────

CREATE TABLE IF NOT EXISTS public.partner_spaces (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id             UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  nickname              TEXT NOT NULL DEFAULT 'Our Wall' CHECK (char_length(nickname) BETWEEN 1 AND 30),
  theme                 TEXT NOT NULL DEFAULT 'cork_board'
                        CHECK (theme IN ('cork_board', 'dark_romantic', 'minimal_white', 'pastel_pink', 'custom')),
  widget_size           TEXT NOT NULL DEFAULT 'medium'
                        CHECK (widget_size IN ('small', 'medium', 'large')),
  custom_color          TEXT,
  time_mood_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  goodnight_active      BOOLEAN NOT NULL DEFAULT FALSE,
  goodnight_message     TEXT CHECK (goodnight_message IS NULL OR char_length(goodnight_message) <= 160),
  goodnight_activated_at TIMESTAMPTZ,
  takeover_active       BOOLEAN NOT NULL DEFAULT FALSE,
  takeover_started_at   TIMESTAMPTZ,
  takeover_by           UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (couple_id)  -- one space per couple
);

CREATE INDEX IF NOT EXISTS idx_partner_spaces_couple ON public.partner_spaces(couple_id);

ALTER TABLE public.partner_spaces
  ADD COLUMN IF NOT EXISTS widget_size TEXT NOT NULL DEFAULT 'medium';

ALTER TABLE public.partner_spaces DROP CONSTRAINT IF EXISTS partner_spaces_widget_size_check;
ALTER TABLE public.partner_spaces
  ADD CONSTRAINT partner_spaces_widget_size_check CHECK (widget_size IN ('small', 'medium', 'large'));

ALTER TABLE public.partner_spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_spaces_access" ON public.partner_spaces;
CREATE POLICY "partner_spaces_access" ON public.partner_spaces
  FOR ALL USING (public.is_couple_member(couple_id));

DROP TRIGGER IF EXISTS set_partner_spaces_updated_at ON public.partner_spaces;
CREATE TRIGGER set_partner_spaces_updated_at
  BEFORE UPDATE ON public.partner_spaces
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ─── 2. PARTNER SPACE ITEMS (canvas content) ─────────────────

CREATE TABLE IF NOT EXISTS public.partner_space_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                UUID NOT NULL REFERENCES public.partner_spaces(id) ON DELETE CASCADE,
  added_by                UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL CHECK (type IN ('photo', 'note', 'sticker', 'drawing', 'gift')),
  content                 JSONB NOT NULL DEFAULT '{}' CHECK (char_length(content::TEXT) <= 8192),
  position_x              REAL NOT NULL DEFAULT 0 CHECK (position_x BETWEEN 0 AND 1000),
  position_y              REAL NOT NULL DEFAULT 0 CHECK (position_y BETWEEN 0 AND 1000),
  width                   REAL NOT NULL DEFAULT 100 CHECK (width BETWEEN 40 AND 320),
  height                  REAL NOT NULL DEFAULT 100 CHECK (height BETWEEN 40 AND 320),
  rotation                REAL NOT NULL DEFAULT 0 CHECK (rotation BETWEEN -30 AND 30),
  z_index                 INT NOT NULL DEFAULT 0 CHECK (z_index BETWEEN 0 AND 1000),
  is_hidden               BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  reaction_emoji          TEXT,
  reacted_by              UUID REFERENCES public.profiles(id),
  disappear_condition     TEXT CHECK (disappear_condition IS NULL OR disappear_condition IN ('after_24h', 'after_seen', 'after_reacted')),
  disappear_at            TIMESTAMPTZ,
  disappeared             BOOLEAN NOT NULL DEFAULT FALSE,
  is_gift_opened          BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_at            TIMESTAMPTZ,
  is_scheduled_published  BOOLEAN NOT NULL DEFAULT TRUE,
  seen_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_space_items_space ON public.partner_space_items(space_id);
CREATE INDEX IF NOT EXISTS idx_partner_space_items_space_active ON public.partner_space_items(space_id)
  WHERE is_deleted = FALSE AND disappeared = FALSE;
CREATE INDEX IF NOT EXISTS idx_partner_space_items_scheduled ON public.partner_space_items(scheduled_at)
  WHERE is_scheduled_published = FALSE AND scheduled_at IS NOT NULL;

ALTER TABLE public.partner_space_items ENABLE ROW LEVEL SECURITY;

-- Both couple members can read items
DROP POLICY IF EXISTS "partner_space_items_select" ON public.partner_space_items;
CREATE POLICY "partner_space_items_select" ON public.partner_space_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.partner_spaces ps
    WHERE ps.id = space_id AND public.is_couple_member(ps.couple_id)
  ));

-- Only the controller (item creator) can insert
DROP POLICY IF EXISTS "partner_space_items_insert" ON public.partner_space_items;
CREATE POLICY "partner_space_items_insert" ON public.partner_space_items
  FOR INSERT WITH CHECK (
    auth.uid() = added_by AND
    EXISTS (
      SELECT 1 FROM public.partner_spaces ps
      WHERE ps.id = space_id AND public.is_couple_member(ps.couple_id)
    )
  );

-- Both members can update (controller repositions, owner reacts/hides)
DROP POLICY IF EXISTS "partner_space_items_update" ON public.partner_space_items;
CREATE POLICY "partner_space_items_update" ON public.partner_space_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.partner_spaces ps
    WHERE ps.id = space_id AND public.is_couple_member(ps.couple_id)
  ));

-- Soft delete only — no physical deletes via RLS
DROP POLICY IF EXISTS "partner_space_items_delete" ON public.partner_space_items;
CREATE POLICY "partner_space_items_delete" ON public.partner_space_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.partner_spaces ps
    WHERE ps.id = space_id AND public.is_couple_member(ps.couple_id)
  ));

DROP TRIGGER IF EXISTS set_partner_space_items_updated_at ON public.partner_space_items;
CREATE TRIGGER set_partner_space_items_updated_at
  BEFORE UPDATE ON public.partner_space_items
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ─── 3. PARTNER SPACE SNAPSHOTS (history timeline) ───────────

CREATE TABLE IF NOT EXISTS public.partner_space_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id        UUID NOT NULL REFERENCES public.partner_spaces(id) ON DELETE CASCADE,
  snapshot_data   JSONB NOT NULL DEFAULT '{}',
  thumbnail_url   TEXT,
  snapshot_type   TEXT NOT NULL DEFAULT 'auto'
                  CHECK (snapshot_type IN ('auto', 'goodnight', 'takeover', 'manual')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_space_snapshots_space ON public.partner_space_snapshots(space_id, created_at DESC);

ALTER TABLE public.partner_space_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_space_snapshots_access" ON public.partner_space_snapshots;
CREATE POLICY "partner_space_snapshots_access" ON public.partner_space_snapshots
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.partner_spaces ps
    WHERE ps.id = space_id AND public.is_couple_member(ps.couple_id)
  ));


-- ─── 4. PARTNER SPACE PERMISSIONS (owner controls) ──────────

CREATE TABLE IF NOT EXISTS public.partner_space_permissions (
  space_id              UUID PRIMARY KEY REFERENCES public.partner_spaces(id) ON DELETE CASCADE,
  allow_photos          BOOLEAN NOT NULL DEFAULT TRUE,
  allow_notes           BOOLEAN NOT NULL DEFAULT TRUE,
  allow_stickers        BOOLEAN NOT NULL DEFAULT TRUE,
  allow_drawings        BOOLEAN NOT NULL DEFAULT TRUE,
  allow_gifts           BOOLEAN NOT NULL DEFAULT TRUE,
  allow_scheduled_drops BOOLEAN NOT NULL DEFAULT TRUE,
  allow_disappearing    BOOLEAN NOT NULL DEFAULT TRUE,
  allow_takeover        BOOLEAN NOT NULL DEFAULT TRUE,
  allow_partner_move    BOOLEAN NOT NULL DEFAULT TRUE,
  allow_partner_delete  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.partner_space_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_space_permissions_access" ON public.partner_space_permissions;
CREATE POLICY "partner_space_permissions_access" ON public.partner_space_permissions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.partner_spaces ps
    WHERE ps.id = space_id AND public.is_couple_member(ps.couple_id)
  ));

DROP TRIGGER IF EXISTS set_partner_space_permissions_updated_at ON public.partner_space_permissions;
CREATE TRIGGER set_partner_space_permissions_updated_at
  BEFORE UPDATE ON public.partner_space_permissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ─── 5. STICKER PACKS (server-driven) ───────────────────────

CREATE TABLE IF NOT EXISTS public.partner_space_sticker_packs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  stickers    JSONB NOT NULL DEFAULT '[]',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.partner_space_sticker_packs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active packs
DROP POLICY IF EXISTS "sticker_packs_read" ON public.partner_space_sticker_packs;
CREATE POLICY "sticker_packs_read" ON public.partner_space_sticker_packs
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- Only service role can manage packs
DROP POLICY IF EXISTS "sticker_packs_admin" ON public.partner_space_sticker_packs;
CREATE POLICY "sticker_packs_admin" ON public.partner_space_sticker_packs
  FOR ALL USING (auth.role() = 'service_role');


-- ─── 6. REALTIME ENABLEMENT ─────────────────────────────────

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE partner_space_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE partner_spaces;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ─── 7. AUTO-PUBLISH SCHEDULED DROPS (RPC) ──────────────────

CREATE OR REPLACE FUNCTION public.publish_scheduled_drops()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.partner_space_items
  SET is_scheduled_published = TRUE, updated_at = NOW()
  WHERE is_scheduled_published = FALSE
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= NOW()
    AND is_deleted = FALSE
    AND EXISTS (
      SELECT 1 FROM public.partner_spaces ps
      WHERE ps.id = partner_space_items.space_id
        AND public.is_couple_member(ps.couple_id)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.publish_scheduled_drops() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_scheduled_drops() TO authenticated;


-- ─── 8. PROCESS DISAPPEARING ITEMS (RPC) ────────────────────

CREATE OR REPLACE FUNCTION public.process_disappearing_items()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  -- Process after_24h items
  UPDATE public.partner_space_items
  SET disappeared = TRUE, updated_at = NOW()
  WHERE disappear_condition = 'after_24h'
    AND disappeared = FALSE
    AND is_deleted = FALSE
    AND created_at + INTERVAL '24 hours' <= NOW()
    AND EXISTS (
      SELECT 1 FROM public.partner_spaces ps
      WHERE ps.id = partner_space_items.space_id
        AND public.is_couple_member(ps.couple_id)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.process_disappearing_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_disappearing_items() TO authenticated;


-- ─── 9. RESET GOODNIGHT MODE (RPC) ──────────────────────────

CREATE OR REPLACE FUNCTION public.reset_goodnight_mode()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.partner_spaces
  SET goodnight_active = FALSE, goodnight_message = NULL, goodnight_activated_at = NULL, updated_at = NOW()
  WHERE goodnight_active = TRUE
    AND goodnight_activated_at IS NOT NULL
    AND goodnight_activated_at + INTERVAL '1 day' <= NOW()
    AND public.is_couple_member(couple_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reset_goodnight_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_goodnight_mode() TO authenticated;


-- ─── 10. STORAGE BUCKET ──────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-space', 'partner-space', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Allow couple members to upload only into their own partner-space folder.
-- Path format: <space_id>/<user_id>/<file>
DROP POLICY IF EXISTS "partner_space_upload" ON storage.objects;
CREATE POLICY "partner_space_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'partner-space'
    AND auth.role() = 'authenticated'
    AND auth.uid() = owner
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
    AND EXISTS (
      SELECT 1 FROM public.partner_spaces ps
      WHERE ps.id = ((storage.foldername(name))[1])::UUID
        AND public.is_couple_member(ps.couple_id)
    )
  );

DROP POLICY IF EXISTS "partner_space_read" ON storage.objects;
CREATE POLICY "partner_space_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'partner-space'
    AND EXISTS (
      SELECT 1 FROM public.partner_spaces ps
      WHERE ps.id = ((storage.foldername(name))[1])::UUID
        AND public.is_couple_member(ps.couple_id)
    )
  );

DROP POLICY IF EXISTS "partner_space_delete" ON storage.objects;
CREATE POLICY "partner_space_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'partner-space'
    AND auth.uid() = owner
    AND EXISTS (
      SELECT 1 FROM public.partner_spaces ps
      WHERE ps.id = ((storage.foldername(name))[1])::UUID
        AND public.is_couple_member(ps.couple_id)
    )
  );
