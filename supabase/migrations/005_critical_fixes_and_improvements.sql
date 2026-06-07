-- Migrations: 005_critical_fixes_and_improvements.sql

-- 1. Couple Letters Schema Changes
ALTER TABLE public.couple_letters 
  ADD COLUMN IF NOT EXISTS parent_letter_id UUID REFERENCES public.couple_letters(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Couple Memories Schema Changes
ALTER TABLE public.couple_memories
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS memory_time TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Triggers for updated_at
CREATE OR REPLACE TRIGGER set_couple_letters_updated_at
  BEFORE UPDATE ON public.couple_letters
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE TRIGGER set_couple_memories_updated_at
  BEFORE UPDATE ON public.couple_memories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 4. Triggers for letter timestamps (delivered_at and read_at)
CREATE OR REPLACE FUNCTION public.on_couple_letter_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deliver_at <= NOW() THEN
    NEW.delivered_at := NOW();
  ELSE
    NEW.delivered_at := NEW.deliver_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_couple_letter_insert
  BEFORE INSERT ON public.couple_letters
  FOR EACH ROW EXECUTE FUNCTION public.on_couple_letter_insert();

CREATE OR REPLACE FUNCTION public.on_couple_letter_read()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = TRUE AND (OLD.is_read = FALSE OR OLD.is_read IS NULL) THEN
    NEW.read_at := NOW();
    IF NEW.delivered_at IS NULL THEN
      IF NEW.deliver_at <= NOW() THEN
        NEW.delivered_at := NOW();
      ELSE
        NEW.delivered_at := NEW.deliver_at;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_couple_letter_read
  BEFORE UPDATE ON public.couple_letters
  FOR EACH ROW EXECUTE FUNCTION public.on_couple_letter_read();

-- 5. Secure letter fetching RPC
CREATE OR REPLACE FUNCTION public.fetch_couple_letters_secure(p_couple_id UUID)
RETURNS TABLE (
  id UUID,
  couple_id UUID,
  sender_id UUID,
  subject TEXT,
  body TEXT,
  deliver_at TIMESTAMPTZ,
  image_urls TEXT[],
  is_draft BOOLEAN,
  is_read BOOLEAN,
  is_favorite BOOLEAN,
  is_archived BOOLEAN,
  created_at TIMESTAMPTZ,
  parent_letter_id UUID,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  sender_nickname TEXT,
  reactions JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.id,
    cl.couple_id,
    cl.sender_id,
    cl.subject,
    CASE 
      WHEN cl.deliver_at <= NOW() OR cl.is_draft = TRUE OR cl.sender_id = auth.uid() THEN cl.body 
      ELSE NULL 
    END AS body,
    cl.deliver_at,
    CASE 
      WHEN cl.deliver_at <= NOW() OR cl.is_draft = TRUE OR cl.sender_id = auth.uid() THEN cl.image_urls 
      ELSE NULL 
    END AS image_urls,
    cl.is_draft,
    cl.is_read,
    cl.is_favorite,
    cl.is_archived,
    cl.created_at,
    cl.parent_letter_id,
    cl.delivered_at,
    cl.read_at,
    cl.updated_at,
    p.nickname AS sender_nickname,
    COALESCE(
      (
        SELECT json_agg(json_build_object('user_id', clr.user_id, 'emoji', clr.emoji))
        FROM public.couple_letter_reactions clr
        WHERE clr.letter_id = cl.id
      ),
      '[]'::json
    ) AS reactions
  FROM public.couple_letters cl
  LEFT JOIN public.profiles p ON p.id = cl.sender_id
  WHERE cl.couple_id = p_couple_id
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = cl.couple_id AND cm.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.fetch_couple_letters_secure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_couple_letters_secure(UUID) TO authenticated;
