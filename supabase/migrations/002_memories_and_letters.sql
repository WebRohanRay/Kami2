-- ============================================================
-- KAMI — Memories & Future Letters
-- ============================================================

-- ─── TABLE: memories ─────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_memories_user_date
  ON memories(user_id, memory_date DESC);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memories_owner_all" ON memories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE memories;

-- ─── TABLE: future_letters ────────────────────────────────────
CREATE TABLE IF NOT EXISTS future_letters (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  deliver_at  TIMESTAMPTZ NOT NULL,          -- when it unlocks
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_future_letters_user_deliver
  ON future_letters(user_id, deliver_at ASC);

ALTER TABLE future_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "future_letters_owner_all" ON future_letters
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_future_letters_updated_at
  BEFORE UPDATE ON future_letters
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
