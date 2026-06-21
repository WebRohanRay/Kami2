-- ============================================================
-- KAMI — Games Feature Migration
-- Safe to run: IF NOT EXISTS / ON CONFLICT on everything
-- Compatible with couple_members junction table schema
-- ============================================================


-- ─── 1. GAME SESSIONS TABLE ────────────────────────────────
-- Game-agnostic: supports tic_tac_toe, connect_four, etc.
-- The `game_state` JSONB holds game-specific board/round data.

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  game_type       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'invited'
                  CHECK (status IN ('invited', 'ready', 'active', 'completed', 'cancelled', 'abandoned')),
  invited_by      UUID NOT NULL REFERENCES public.profiles(id),
  accepted_by     UUID REFERENCES public.profiles(id),
  winner_id       UUID REFERENCES public.profiles(id),
  result          TEXT CHECK (result IS NULL OR result IN ('win', 'draw', 'abandoned')),
  current_turn_id UUID REFERENCES public.profiles(id),
  game_state      JSONB NOT NULL DEFAULT '{}',
  move_count      INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuse existing updated_at trigger
DROP TRIGGER IF EXISTS set_game_sessions_updated_at ON public.game_sessions;
CREATE TRIGGER set_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── CRITICAL: Partial unique index — prevents duplicate active sessions ───
-- Only one non-terminal session per couple per game_type at a time.
-- This is the DB-level race condition guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_sessions_active_unique
  ON public.game_sessions (couple_id, game_type)
  WHERE status IN ('invited', 'ready', 'active');


-- ─── 2. GAME MOVES TABLE ───────────────────────────────────
-- Per-move history for replay and audit trail.

CREATE TABLE IF NOT EXISTS public.game_moves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES public.profiles(id),
  move_number     INT NOT NULL,
  move_data       JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, move_number)
);


-- ─── 3. GAME STATS TABLE ───────────────────────────────────
-- Aggregated per-user-per-couple-per-game statistics.
-- Only written by server-side trigger — never by client.

CREATE TABLE IF NOT EXISTS public.game_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  game_type       TEXT NOT NULL,
  total_played    INT NOT NULL DEFAULT 0,
  total_wins      INT NOT NULL DEFAULT 0,
  total_losses    INT NOT NULL DEFAULT 0,
  total_draws     INT NOT NULL DEFAULT 0,
  current_streak  INT NOT NULL DEFAULT 0,
  longest_streak  INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(couple_id, user_id, game_type)
);


-- ─── 4. INDEXES ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_game_sessions_couple
  ON public.game_sessions(couple_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_sessions_status
  ON public.game_sessions(couple_id, status);

CREATE INDEX IF NOT EXISTS idx_game_sessions_type
  ON public.game_sessions(couple_id, game_type);

CREATE INDEX IF NOT EXISTS idx_game_moves_session
  ON public.game_moves(session_id, move_number);

CREATE INDEX IF NOT EXISTS idx_game_stats_couple
  ON public.game_stats(couple_id, game_type);


-- ─── 5. RLS POLICIES ──────────────────────────────────────

-- Game Sessions
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_sessions_select" ON public.game_sessions;
CREATE POLICY "game_sessions_select"
  ON public.game_sessions FOR SELECT
  USING (public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "game_sessions_insert" ON public.game_sessions;
CREATE POLICY "game_sessions_insert"
  ON public.game_sessions FOR INSERT
  WITH CHECK (
    public.is_couple_member(couple_id)
    AND auth.uid() = invited_by
  );

-- CRITICAL: UPDATE policy enforces turn order.
-- Only the player whose turn it is can update, OR either player can
-- update non-active sessions (accept invite, cancel, etc.).
DROP POLICY IF EXISTS "game_sessions_update" ON public.game_sessions;
CREATE POLICY "game_sessions_update"
  ON public.game_sessions FOR UPDATE
  USING (
    public.is_couple_member(couple_id)
    AND (
      -- Non-active sessions: either partner can update (accept, cancel, ready)
      status NOT IN ('active')
      -- Active sessions: only the RPC function updates (SECURITY DEFINER bypasses RLS)
      -- Direct client updates on active sessions are blocked
      OR auth.uid() = current_turn_id
    )
  );

DROP POLICY IF EXISTS "game_sessions_delete" ON public.game_sessions;
CREATE POLICY "game_sessions_delete"
  ON public.game_sessions FOR DELETE
  USING (
    public.is_couple_member(couple_id)
    AND auth.uid() = invited_by
    AND status IN ('invited', 'cancelled')
  );


-- Game Moves — read-only for clients (writes go through RPC)
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_moves_select" ON public.game_moves;
CREATE POLICY "game_moves_select"
  ON public.game_moves FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = session_id AND public.is_couple_member(gs.couple_id)
  ));

-- No direct INSERT policy — moves are created by make_game_move() RPC only


-- Game Stats — read-only for clients (writes go through trigger)
ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_stats_select" ON public.game_stats;
CREATE POLICY "game_stats_select"
  ON public.game_stats FOR SELECT
  USING (public.is_couple_member(couple_id));

-- No INSERT/UPDATE policies — stats are written by SECURITY DEFINER trigger only


-- ─── 6. ATOMIC MOVE RPC ────────────────────────────────────
-- Single transaction: validates turn, validates cell, updates board,
-- checks win/draw, inserts move, updates session, all atomically.
-- This is the ONLY way moves happen — no direct client writes.

CREATE OR REPLACE FUNCTION public.make_game_move(
  p_session_id UUID,
  p_cell_index INT,
  p_player_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_session    RECORD;
  v_board      JSONB;
  v_symbol     TEXT;
  v_partner_id UUID;
  v_new_board  JSONB;
  v_move_count INT;
  v_winner     TEXT;
  v_win_line   JSONB;
  v_result     TEXT;
  v_new_status TEXT;
  v_new_turn   UUID;
  v_players    JSONB;
BEGIN
  -- 1. Lock session row to prevent concurrent moves
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found.';
  END IF;

  -- 2. Verify caller is a couple member
  IF NOT public.is_couple_member(v_session.couple_id) THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  -- 3. Verify game is active
  IF v_session.status != 'active' THEN
    RAISE EXCEPTION 'Game is not active. Status: %', v_session.status;
  END IF;

  -- 4. Verify it's this player's turn
  IF v_session.current_turn_id != p_player_id THEN
    RAISE EXCEPTION 'Not your turn.';
  END IF;

  -- 5. Extract board and players
  v_board := v_session.game_state -> 'board';
  v_players := v_session.game_state -> 'players';

  IF v_board IS NULL OR v_players IS NULL THEN
    RAISE EXCEPTION 'Invalid game state.';
  END IF;

  -- 6. Validate cell index (0-8 for tic tac toe)
  IF p_cell_index < 0 OR p_cell_index > 8 THEN
    RAISE EXCEPTION 'Invalid cell index: %', p_cell_index;
  END IF;

  -- 7. Validate cell is empty
  IF v_board -> p_cell_index != 'null'::jsonb THEN
    RAISE EXCEPTION 'Cell % is already occupied.', p_cell_index;
  END IF;

  -- 8. Determine symbol and partner
  IF (v_players ->> 'X') = p_player_id::TEXT THEN
    v_symbol := 'X';
    v_partner_id := (v_players ->> 'O')::UUID;
  ELSIF (v_players ->> 'O') = p_player_id::TEXT THEN
    v_symbol := 'O';
    v_partner_id := (v_players ->> 'X')::UUID;
  ELSE
    RAISE EXCEPTION 'Player not in this game.';
  END IF;

  -- 9. Apply move to board
  v_new_board := jsonb_set(v_board, ARRAY[p_cell_index::TEXT], to_jsonb(v_symbol));
  v_move_count := v_session.move_count + 1;

  -- 10. Check for winner
  v_winner := NULL;
  v_win_line := NULL;

  -- Check all 8 winning combinations
  IF (v_new_board ->> '0') = v_symbol AND (v_new_board ->> '1') = v_symbol AND (v_new_board ->> '2') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[0,1,2]'::jsonb;
  ELSIF (v_new_board ->> '3') = v_symbol AND (v_new_board ->> '4') = v_symbol AND (v_new_board ->> '5') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[3,4,5]'::jsonb;
  ELSIF (v_new_board ->> '6') = v_symbol AND (v_new_board ->> '7') = v_symbol AND (v_new_board ->> '8') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[6,7,8]'::jsonb;
  ELSIF (v_new_board ->> '0') = v_symbol AND (v_new_board ->> '3') = v_symbol AND (v_new_board ->> '6') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[0,3,6]'::jsonb;
  ELSIF (v_new_board ->> '1') = v_symbol AND (v_new_board ->> '4') = v_symbol AND (v_new_board ->> '7') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[1,4,7]'::jsonb;
  ELSIF (v_new_board ->> '2') = v_symbol AND (v_new_board ->> '5') = v_symbol AND (v_new_board ->> '8') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[2,5,8]'::jsonb;
  ELSIF (v_new_board ->> '0') = v_symbol AND (v_new_board ->> '4') = v_symbol AND (v_new_board ->> '8') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[0,4,8]'::jsonb;
  ELSIF (v_new_board ->> '2') = v_symbol AND (v_new_board ->> '4') = v_symbol AND (v_new_board ->> '6') = v_symbol THEN
    v_winner := v_symbol; v_win_line := '[2,4,6]'::jsonb;
  END IF;

  -- 11. Determine result and new status
  IF v_winner IS NOT NULL THEN
    v_result := 'win';
    v_new_status := 'completed';
    v_new_turn := NULL;
  ELSIF v_move_count >= 9 THEN
    v_result := 'draw';
    v_new_status := 'completed';
    v_new_turn := NULL;
  ELSE
    v_result := NULL;
    v_new_status := 'active';
    v_new_turn := v_partner_id;
  END IF;

  -- 12. Update session atomically
  UPDATE public.game_sessions SET
    game_state = jsonb_set(
      jsonb_set(
        jsonb_set(v_session.game_state, '{board}', v_new_board),
        '{winner}', COALESCE(to_jsonb(v_winner), 'null'::jsonb)
      ),
      '{winLine}', COALESCE(v_win_line, 'null'::jsonb)
    ),
    move_count = v_move_count,
    current_turn_id = v_new_turn,
    status = v_new_status,
    result = v_result,
    winner_id = CASE WHEN v_winner IS NOT NULL THEN p_player_id ELSE NULL END,
    completed_at = CASE WHEN v_new_status = 'completed' THEN NOW() ELSE NULL END
  WHERE id = p_session_id;

  -- 13. Insert move record
  INSERT INTO public.game_moves (session_id, player_id, move_number, move_data)
  VALUES (p_session_id, p_player_id, v_move_count, jsonb_build_object(
    'cell', p_cell_index,
    'symbol', v_symbol,
    'result', v_result
  ));

  -- 14. Return updated state for optimistic reconciliation
  RETURN jsonb_build_object(
    'success', true,
    'board', v_new_board,
    'moveCount', v_move_count,
    'symbol', v_symbol,
    'nextTurn', v_new_turn,
    'status', v_new_status,
    'result', v_result,
    'winner', v_winner,
    'winLine', v_win_line,
    'winnerId', CASE WHEN v_winner IS NOT NULL THEN p_player_id::TEXT ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.make_game_move(UUID, INT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.make_game_move(UUID, INT, UUID) TO authenticated;


-- ─── 7. SERVER-SIDE STAT UPDATE TRIGGER ────────────────────
-- Fires when game_sessions.status becomes 'completed'.
-- Upserts game_stats for both players atomically.
-- Mirrors the candid streak trigger pattern.

CREATE OR REPLACE FUNCTION public.update_game_stats_on_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_player1_id UUID;
  v_player2_id UUID;
  v_players    JSONB;
BEGIN
  -- Only fire on status transition to 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_players := NEW.game_state -> 'players';
  IF v_players IS NULL THEN
    RETURN NEW;
  END IF;

  v_player1_id := (v_players ->> 'X')::UUID;
  v_player2_id := (v_players ->> 'O')::UUID;

  -- Upsert stats for player 1 (X)
  INSERT INTO public.game_stats (couple_id, user_id, game_type, total_played, total_wins, total_losses, total_draws, current_streak, longest_streak)
  VALUES (
    NEW.couple_id,
    v_player1_id,
    NEW.game_type,
    1,
    CASE WHEN NEW.winner_id = v_player1_id THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'win' AND NEW.winner_id != v_player1_id THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
    CASE WHEN NEW.winner_id = v_player1_id THEN 1 ELSE 0 END,
    CASE WHEN NEW.winner_id = v_player1_id THEN 1 ELSE 0 END
  )
  ON CONFLICT (couple_id, user_id, game_type) DO UPDATE SET
    total_played = game_stats.total_played + 1,
    total_wins = game_stats.total_wins + CASE WHEN NEW.winner_id = v_player1_id THEN 1 ELSE 0 END,
    total_losses = game_stats.total_losses + CASE WHEN NEW.result = 'win' AND NEW.winner_id != v_player1_id THEN 1 ELSE 0 END,
    total_draws = game_stats.total_draws + CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
    current_streak = CASE
      WHEN NEW.winner_id = v_player1_id THEN game_stats.current_streak + 1
      ELSE 0
    END,
    longest_streak = GREATEST(
      game_stats.longest_streak,
      CASE WHEN NEW.winner_id = v_player1_id THEN game_stats.current_streak + 1 ELSE 0 END
    ),
    updated_at = NOW();

  -- Upsert stats for player 2 (O)
  INSERT INTO public.game_stats (couple_id, user_id, game_type, total_played, total_wins, total_losses, total_draws, current_streak, longest_streak)
  VALUES (
    NEW.couple_id,
    v_player2_id,
    NEW.game_type,
    1,
    CASE WHEN NEW.winner_id = v_player2_id THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'win' AND NEW.winner_id != v_player2_id THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
    CASE WHEN NEW.winner_id = v_player2_id THEN 1 ELSE 0 END,
    CASE WHEN NEW.winner_id = v_player2_id THEN 1 ELSE 0 END
  )
  ON CONFLICT (couple_id, user_id, game_type) DO UPDATE SET
    total_played = game_stats.total_played + 1,
    total_wins = game_stats.total_wins + CASE WHEN NEW.winner_id = v_player2_id THEN 1 ELSE 0 END,
    total_losses = game_stats.total_losses + CASE WHEN NEW.result = 'win' AND NEW.winner_id != v_player2_id THEN 1 ELSE 0 END,
    total_draws = game_stats.total_draws + CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
    current_streak = CASE
      WHEN NEW.winner_id = v_player2_id THEN game_stats.current_streak + 1
      ELSE 0
    END,
    longest_streak = GREATEST(
      game_stats.longest_streak,
      CASE WHEN NEW.winner_id = v_player2_id THEN game_stats.current_streak + 1 ELSE 0 END
    ),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.update_game_stats_on_complete() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_game_complete_update_stats ON public.game_sessions;
CREATE TRIGGER on_game_complete_update_stats
  AFTER UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_game_stats_on_complete();


-- ─── 8. REALTIME ENABLEMENT ────────────────────────────────

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_moves;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_stats;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ─── 9. TABLE GRANTS ──────────────────────────────────────

GRANT ALL ON TABLE public.game_sessions TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.game_moves TO postgres, authenticated, service_role;
GRANT ALL ON TABLE public.game_stats TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.make_game_move(UUID, INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_game_stats_on_complete() TO service_role;
