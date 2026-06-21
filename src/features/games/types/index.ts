// ─── Games Feature — Type Definitions ─────────────────────────────────────────

/** Supported game types — extend this union for future games */
export type GameType = 'tic_tac_toe';

/** Game session lifecycle status */
export type GameSessionStatus =
  | 'invited'    // invitation sent, waiting for partner
  | 'ready'      // both partners ready (mutual-ready flow)
  | 'active'     // game in progress
  | 'completed'  // game finished (win/draw)
  | 'cancelled'  // invitation cancelled/declined
  | 'abandoned'; // partner disconnected (future)

/** Game result when completed */
export type GameResult = 'win' | 'draw' | 'abandoned';

/** Tic Tac Toe cell values */
export type TicTacToeSymbol = 'X' | 'O';
export type TicTacToeCell = TicTacToeSymbol | null;

/** Tic Tac Toe specific game state stored in game_sessions.game_state JSONB */
export interface TicTacToeState {
  board: TicTacToeCell[];
  players: { X: string; O: string };
  winner: TicTacToeSymbol | null;
  winLine: number[] | null;
}

/** A game session row from Supabase */
export interface GameSession {
  id: string;
  coupleId: string;
  gameType: GameType;
  status: GameSessionStatus;
  invitedBy: string;
  acceptedBy: string | null;
  winnerId: string | null;
  result: GameResult | null;
  currentTurnId: string | null;
  gameState: TicTacToeState; // union with other game states in future
  moveCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Enriched client-side
  invitedByNickname?: string;
  acceptedByNickname?: string;
  winnerNickname?: string;
}

/** A single game move record */
export interface GameMove {
  id: string;
  sessionId: string;
  playerId: string;
  moveNumber: number;
  moveData: {
    cell: number;
    symbol: TicTacToeSymbol;
    result: GameResult | null;
  };
  createdAt: string;
}

/** Aggregated game statistics per user per game type */
export interface GameStats {
  id: string;
  coupleId: string;
  userId: string;
  gameType: GameType;
  totalPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  currentStreak: number;
  longestStreak: number;
  updatedAt: string;
}

/** Result returned by the make_game_move RPC */
export interface MakeMoveResult {
  success: boolean;
  board: TicTacToeCell[];
  moveCount: number;
  symbol: TicTacToeSymbol;
  nextTurn: string | null;
  status: GameSessionStatus;
  result: GameResult | null;
  winner: TicTacToeSymbol | null;
  winLine: number[] | null;
  winnerId: string | null;
}

/** Game type metadata for the games hub UI */
export interface GameTypeConfig {
  type: GameType;
  name: string;
  emoji: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  available: boolean;
}

/** All available games — extend this array when adding new games */
export const GAME_CONFIGS: GameTypeConfig[] = [
  {
    type: 'tic_tac_toe',
    name: 'Tic Tac Toe',
    emoji: '❌⭕',
    description: 'Classic 3×3 strategy game',
    minPlayers: 2,
    maxPlayers: 2,
    available: true,
  },
  // Future games:
  // { type: 'connect_four', name: 'Connect Four', emoji: '🔴🟡', ... },
  // { type: 'rock_paper_scissors', name: 'Rock Paper Scissors', emoji: '✊✋✌️', ... },
];

/** Helper to create a fresh Tic Tac Toe board */
export function createEmptyTicTacToeState(playerId1: string, playerId2: string): TicTacToeState {
  return {
    board: [null, null, null, null, null, null, null, null, null],
    players: { X: playerId1, O: playerId2 },
    winner: null,
    winLine: null,
  };
}
