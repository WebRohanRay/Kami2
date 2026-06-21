/**
 * gamesService.ts
 * Supabase CRUD operations for the Games feature.
 * All move logic goes through the atomic make_game_move() RPC.
 */
import { supabase } from '@shared/lib/supabase';
import type {
  GameSession,
  GameStats,
  GameType,
  MakeMoveResult,
  TicTacToeState,
} from '../types';
import { createEmptyTicTacToeState } from '../types';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function mapSessionRow(row: any, myId?: string, partnerName?: string): GameSession {
  const isMe = (id: string | null) => id === myId;
  return {
    id: row.id,
    coupleId: row.couple_id,
    gameType: row.game_type,
    status: row.status,
    invitedBy: row.invited_by,
    acceptedBy: row.accepted_by,
    winnerId: row.winner_id,
    result: row.result,
    currentTurnId: row.current_turn_id,
    gameState: row.game_state || { board: Array(9).fill(null), players: {}, winner: null, winLine: null },
    moveCount: row.move_count || 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invitedByNickname: isMe(row.invited_by) ? 'You' : (partnerName || 'Partner'),
    winnerNickname: row.winner_id
      ? (isMe(row.winner_id) ? 'You' : (partnerName || 'Partner'))
      : undefined,
  };
}

function mapStatsRow(row: any): GameStats {
  return {
    id: row.id,
    coupleId: row.couple_id,
    userId: row.user_id,
    gameType: row.game_type,
    totalPlayed: row.total_played,
    totalWins: row.total_wins,
    totalLosses: row.total_losses,
    totalDraws: row.total_draws,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    updatedAt: row.updated_at,
  };
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

/** Fetch the current active/invited session for a couple + game type */
export async function fetchActiveSession(
  coupleId: string,
  gameType: GameType,
  myId: string,
  partnerName?: string
): Promise<GameSession | null> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('game_type', gameType)
    .in('status', ['invited', 'ready', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[gamesService] fetchActiveSession error:', error);
    return null;
  }
  return data ? mapSessionRow(data, myId, partnerName) : null;
}

/** Create a game invitation */
export async function createInvitation(
  coupleId: string,
  gameType: GameType,
  invitedBy: string,
  partnerId: string
): Promise<GameSession | null> {
  const gameState: TicTacToeState = createEmptyTicTacToeState(invitedBy, partnerId);

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      couple_id: coupleId,
      game_type: gameType,
      status: 'invited',
      invited_by: invitedBy,
      current_turn_id: invitedBy, // inviter goes first (X)
      game_state: gameState,
    })
    .select()
    .single();

  if (error) {
    // Duplicate active session race — partial unique index caught it
    if (error.code === '23505') {
      console.warn('[gamesService] Duplicate active session prevented by DB constraint.');
      return null;
    }
    console.error('[gamesService] createInvitation error:', error);
    return null;
  }
  return data ? mapSessionRow(data, invitedBy) : null;
}

/** Accept an invitation — transitions to active */
export async function acceptInvitation(
  sessionId: string,
  acceptedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('game_sessions')
    .update({
      status: 'active',
      accepted_by: acceptedBy,
      started_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('status', 'invited');

  if (error) {
    console.error('[gamesService] acceptInvitation error:', error);
    return false;
  }
  return true;
}

/** Decline / cancel an invitation */
export async function cancelInvitation(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('game_sessions')
    .update({ status: 'cancelled' })
    .eq('id', sessionId)
    .in('status', ['invited', 'ready']);

  if (error) {
    console.error('[gamesService] cancelInvitation error:', error);
    return false;
  }
  return true;
}

/** Create a game from mutual ready-up (both on screen) */
export async function createReadyGame(
  coupleId: string,
  gameType: GameType,
  player1Id: string,
  player2Id: string
): Promise<GameSession | null> {
  const gameState: TicTacToeState = createEmptyTicTacToeState(player1Id, player2Id);

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      couple_id: coupleId,
      game_type: gameType,
      status: 'active',
      invited_by: player1Id,
      accepted_by: player2Id,
      current_turn_id: player1Id,
      game_state: gameState,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.warn('[gamesService] Duplicate active session prevented by DB constraint.');
      return null;
    }
    console.error('[gamesService] createReadyGame error:', error);
    return null;
  }
  return data ? mapSessionRow(data, player1Id) : null;
}

// ─── Atomic Move (RPC) ───────────────────────────────────────────────────────

/** Execute a move via the server-side RPC — atomic, tamper-proof */
export async function makeMove(
  sessionId: string,
  cellIndex: number,
  playerId: string
): Promise<MakeMoveResult | null> {
  const { data, error } = await supabase
    .rpc('make_game_move', {
      p_session_id: sessionId,
      p_cell_index: cellIndex,
      p_player_id: playerId,
    });

  if (error) {
    console.error('[gamesService] makeMove RPC error:', error);
    return null;
  }

  // RPC returns JSONB — Supabase parses it automatically
  const result = data as any;
  return {
    success: result.success,
    board: result.board,
    moveCount: result.moveCount,
    symbol: result.symbol,
    nextTurn: result.nextTurn,
    status: result.status,
    result: result.result,
    winner: result.winner,
    winLine: result.winLine,
    winnerId: result.winnerId,
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/** Fetch game stats for both partners */
export async function fetchGameStats(
  coupleId: string,
  gameType: GameType
): Promise<GameStats[]> {
  const { data, error } = await supabase
    .from('game_stats')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('game_type', gameType);

  if (error) {
    console.error('[gamesService] fetchGameStats error:', error);
    return [];
  }
  return (data || []).map(mapStatsRow);
}

// ─── History ──────────────────────────────────────────────────────────────────

const HISTORY_PAGE_SIZE = 20;

/** Fetch completed game history with pagination */
export async function fetchGameHistory(
  coupleId: string,
  gameType: GameType,
  page: number,
  myId: string,
  partnerName?: string
): Promise<{ sessions: GameSession[]; hasMore: boolean }> {
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE;

  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('game_type', gameType)
    .in('status', ['completed', 'abandoned'])
    .order('completed_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[gamesService] fetchGameHistory error:', error);
    return { sessions: [], hasMore: false };
  }

  const sessions = (data || []).map((row) => mapSessionRow(row, myId, partnerName));
  return {
    sessions,
    hasMore: sessions.length > HISTORY_PAGE_SIZE,
  };
}

/** Fetch all completed sessions for a game type (for stats screen) */
export async function fetchAllCompletedSessions(
  coupleId: string,
  gameType: GameType,
  myId: string,
  partnerName?: string
): Promise<GameSession[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('game_type', gameType)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[gamesService] fetchAllCompletedSessions error:', error);
    return [];
  }
  return (data || []).map((row) => mapSessionRow(row, myId, partnerName));
}
