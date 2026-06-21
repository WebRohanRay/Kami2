/**
 * useGames — Main hook for Games feature.
 * Handles data loading (gated behind couple_id readiness),
 * game actions, presence broadcast, and optimistic moves.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@features/auth';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useGamesStore } from '../store/gamesStore';
import { triggerLocalNotificationAsync } from '@infrastructure/notifications/notificationService';
import { supabase } from '@shared/lib/supabase';
import * as gamesService from '../services/gamesService';
import type { GameType, TicTacToeCell } from '../types';

export function useGames(gameType: GameType = 'tic_tac_toe') {
  const user = useAuthStore((s) => s.user);
  const couple = useCoupleStore((s) => s.couple);
  const partner = useCoupleStore((s) => s.partner);
  const store = useGamesStore();
  const loadedRef = useRef(false);

  const myId = user?.id;
  const coupleId = couple?.id;
  const partnerId = partner?.id;
  const partnerName = partner?.nickname || 'Partner';

  // ── Initial Fetch (gated behind couple_id readiness) ──────────────────────
  useEffect(() => {
    if (!myId || !coupleId || loadedRef.current) return;
    loadedRef.current = true;

    loadActiveSession();
    loadStats();
    loadHistory(1);
  }, [myId, coupleId]);

  // ── Load Active Session ───────────────────────────────────────────────────
  const loadActiveSession = useCallback(async () => {
    if (!myId || !coupleId) return;
    store.setSessionLoading('loading');
    try {
      const session = await gamesService.fetchActiveSession(coupleId, gameType, myId, partnerName);
      if (session) {
        if (session.status === 'active') {
          store.setActiveSession(session);
        } else if (session.status === 'invited') {
          if (session.invitedBy === myId) {
            store.setSentInvite(session);
          } else {
            store.setPendingInvite(session);
          }
        }
      }
      store.setSessionLoading('idle');
    } catch (e) {
      console.error('[useGames] loadActiveSession error:', e);
      store.setSessionLoading('error');
    }
  }, [myId, coupleId, gameType, partnerName]);

  // ── Load Stats ────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!myId || !coupleId) return;
    store.setStatsLoading('loading');
    try {
      const stats = await gamesService.fetchGameStats(coupleId, gameType);
      const mine = stats.find((s) => s.userId === myId) || null;
      const theirs = stats.find((s) => s.userId !== myId) || null;
      store.setMyStats(mine);
      store.setPartnerStats(theirs);
      store.setStatsLoading('idle');
    } catch (e) {
      console.error('[useGames] loadStats error:', e);
      store.setStatsLoading('error');
    }
  }, [myId, coupleId, gameType]);

  // ── Load History ──────────────────────────────────────────────────────────
  const loadHistory = useCallback(async (page: number) => {
    if (!myId || !coupleId) return;
    store.setHistoryLoading(page === 1 ? 'loading' : 'refreshing');
    try {
      const { sessions, hasMore } = await gamesService.fetchGameHistory(
        coupleId, gameType, page, myId, partnerName
      );
      if (page === 1) {
        store.setGameHistory(sessions);
      } else {
        store.appendGameHistory(sessions);
      }
      store.setHistoryPage(page);
      store.setHistoryHasMore(hasMore);
      store.setHistoryLoading('idle');
    } catch (e) {
      console.error('[useGames] loadHistory error:', e);
      store.setHistoryLoading('error');
    }
  }, [myId, coupleId, gameType, partnerName]);

  // ── Send Invitation ───────────────────────────────────────────────────────
  const sendInvitation = useCallback(async () => {
    if (!myId || !coupleId || !partnerId) return false;
    const session = await gamesService.createInvitation(coupleId, gameType, myId, partnerId);
    if (session) {
      store.setSentInvite(session);
      // Notification to partner handled by CoupleRealtimeListener
      return true;
    }
    return false;
  }, [myId, coupleId, partnerId, gameType]);

  // ── Accept Invitation ─────────────────────────────────────────────────────
  const acceptInvitation = useCallback(async () => {
    const invite = store.pendingInvite;
    if (!invite || !myId) return false;
    const ok = await gamesService.acceptInvitation(invite.id, myId);
    if (ok) {
      store.setPendingInvite(null);
      // Active session will arrive via realtime
      return true;
    }
    return false;
  }, [myId]);

  // ── Decline / Cancel Invitation ───────────────────────────────────────────
  const declineInvitation = useCallback(async () => {
    const invite = store.pendingInvite || store.sentInvite;
    if (!invite) return false;
    const ok = await gamesService.cancelInvitation(invite.id);
    if (ok) {
      store.setPendingInvite(null);
      store.setSentInvite(null);
      return true;
    }
    return false;
  }, []);

  // ── Start from Mutual Ready ───────────────────────────────────────────────
  const startFromReady = useCallback(async () => {
    if (!myId || !coupleId || !partnerId) return false;
    const session = await gamesService.createReadyGame(coupleId, gameType, myId, partnerId);
    if (session) {
      store.setActiveSession(session);
      store.setMyReady(false);
      store.setPartnerReady(false);
      return true;
    }
    return false;
  }, [myId, coupleId, partnerId, gameType]);

  // ── Broadcast Ready State ─────────────────────────────────────────────────
  const broadcastReady = useCallback((ready: boolean) => {
    if (!coupleId || !myId) return;
    store.setMyReady(ready);
    const channelName = `game_realtime_${coupleId}`;
    const channels = supabase.getChannels();
    const ch = channels.find(
      (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
    );
    if (ch) {
      ch.send({
        type: 'broadcast',
        event: 'game_presence',
        payload: { userId: myId, type: 'ready', ready },
      });
    }
  }, [coupleId, myId]);

  // ── Make Move (Optimistic + Server) ───────────────────────────────────────
  const makeMove = useCallback(async (cellIndex: number) => {
    const session = store.activeSession;
    if (!session || !myId) return false;
    if (session.currentTurnId !== myId) return false;
    if (session.status !== 'active') return false;

    const board = session.gameState.board;
    if (board[cellIndex] !== null) return false;

    // Determine my symbol
    const mySymbol = session.gameState.players.X === myId ? 'X' : 'O';

    // Optimistic: apply move locally immediately
    const optimisticBoard: TicTacToeCell[] = [...board];
    optimisticBoard[cellIndex] = mySymbol;
    store.setOptimisticBoard(optimisticBoard);

    // Server: atomic RPC call
    const result = await gamesService.makeMove(session.id, cellIndex, myId);

    if (!result || !result.success) {
      // Rollback optimistic move
      store.setOptimisticBoard(null);
      console.error('[useGames] Move failed, rolled back.');
      return false;
    }

    // Server confirmed — clear optimistic (realtime will bring the final state)
    store.setOptimisticBoard(null);
    return true;
  }, [myId]);

  // ── Rematch ───────────────────────────────────────────────────────────────
  const requestRematch = useCallback(async () => {
    // Clear current session and send a new invitation
    store.setActiveSession(null);
    return sendInvitation();
  }, [sendInvitation]);

  return {
    // State (re-exported for convenience)
    activeSession: store.activeSession,
    pendingInvite: store.pendingInvite,
    sentInvite: store.sentInvite,
    myReady: store.myReady,
    partnerReady: store.partnerReady,
    partnerOnScreen: store.partnerOnScreen,
    optimisticBoard: store.optimisticBoard,
    myStats: store.myStats,
    partnerStats: store.partnerStats,
    gameHistory: store.gameHistory,
    historyHasMore: store.historyHasMore,
    sessionLoading: store.sessionLoading,
    statsLoading: store.statsLoading,
    historyLoading: store.historyLoading,
    toast: store.toast,

    // Actions
    loadActiveSession,
    loadStats,
    loadHistory,
    sendInvitation,
    acceptInvitation,
    declineInvitation,
    startFromReady,
    broadcastReady,
    makeMove,
    requestRematch,
    setToast: store.setToast,
  };
}
