import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '@features/auth';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useGamesStore } from '../store/gamesStore';
import { supabase } from '@shared/lib/supabase';
import { useNetworkStatus } from '@shared/network/NetworkProvider';
import type { GameSession, TicTacToeState } from '../types';

/**
 * GamesRealtimeListener
 * 
 * Subscribes to:
 *  - postgres_changes on game_sessions (filtered by couple_id)
 *  - postgres_changes on game_stats (filtered by couple_id)
 *  - broadcast for game_presence (ready state, screen visibility)
 *  - Supabase Presence for partner-on-screen detection
 *
 * Mount inside GamesNavigator (follows PartnerSpaceRealtimeListener pattern).
 * Renders nothing.
 */
export function GamesRealtimeListener() {
  const user = useAuthStore((s) => s.user);
  const couple = useCoupleStore((s) => s.couple);
  const partner = useCoupleStore((s) => s.partner);
  const { isConnected } = useNetworkStatus();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id || !couple?.id || !isConnected) return;

    const coupleId = couple.id;
    const myId = user.id;
    const partnerName = partner?.nickname || 'Partner';
    let channel: any = null;
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    const mapSessionRow = (row: any): GameSession => ({
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
      invitedByNickname: row.invited_by === myId ? 'You' : partnerName,
      winnerNickname: row.winner_id
        ? (row.winner_id === myId ? 'You' : partnerName)
        : undefined,
    });

    const setupSubscription = () => {
      const channelName = `game_realtime_${coupleId}`;

      // Clean up existing channel
      try {
        const existing = supabase.getChannels().find(
          (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }
      } catch (e) {
        console.warn('[GamesRealtimeListener] Failed to clean up existing channel:', e);
      }

      channel = supabase.channel(channelName, {
        config: { presence: { key: myId } },
      })
        // ── Game Sessions ──────────────────────────────────────────
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `couple_id=eq.${coupleId}`,
        }, (payload) => {
          const store = useGamesStore.getState();

          if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              if (store.activeSession?.id === oldId) store.setActiveSession(null);
              if (store.pendingInvite?.id === oldId) store.setPendingInvite(null);
              if (store.sentInvite?.id === oldId) store.setSentInvite(null);
            }
            return;
          }

          const row = payload.new as any;
          const mapped = mapSessionRow(row);

          // Route to correct store slot based on status and who invited
          if (mapped.status === 'active') {
            store.setActiveSession(mapped);
            store.setPendingInvite(null);
            store.setSentInvite(null);
          } else if (mapped.status === 'completed' || mapped.status === 'abandoned') {
            // Game just finished
            if (store.activeSession?.id === mapped.id) {
              store.setActiveSession(mapped);
            }
            store.setPendingInvite(null);
            store.setSentInvite(null);
          } else if (mapped.status === 'cancelled') {
            if (store.activeSession?.id === mapped.id) store.setActiveSession(null);
            if (store.pendingInvite?.id === mapped.id) store.setPendingInvite(null);
            if (store.sentInvite?.id === mapped.id) store.setSentInvite(null);
          } else if (mapped.status === 'invited') {
            if (mapped.invitedBy === myId) {
              store.setSentInvite(mapped);
            } else {
              store.setPendingInvite(mapped);
            }
          }
        })

        // ── Game Stats ─────────────────────────────────────────────
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'game_stats',
          filter: `couple_id=eq.${coupleId}`,
        }, (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as any;
          const store = useGamesStore.getState();
          const stat = {
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
          if (row.user_id === myId) {
            store.setMyStats(stat);
          } else {
            store.setPartnerStats(stat);
          }
        })

        // ── Broadcast: Game Presence ───────────────────────────────
        .on('broadcast', { event: 'game_presence' }, (payload: any) => {
          const data = payload?.payload;
          if (data?.userId !== myId) {
            const store = useGamesStore.getState();
            if (data?.type === 'ready') {
              store.setPartnerReady(!!data.ready);
            }
          }
        })

        // ── Supabase Presence: Partner on screen ───────────────────
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const store = useGamesStore.getState();
          const partnerPresent = Object.keys(presenceState).some(
            (key) => key !== myId
          );
          store.setPartnerOnScreen(partnerPresent);
          if (!partnerPresent) {
            store.setPartnerReady(false);
          }
        })
        .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
          if (key !== myId) {
            const store = useGamesStore.getState();
            store.setPartnerOnScreen(false);
            store.setPartnerReady(false);
          }
        })

        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            // Track my presence
            await channel.track({
              userId: myId,
              screen: 'games',
              online_at: new Date().toISOString(),
            });
          }
        });

      channelRef.current = channel;
    };

    debounceTimeout = setTimeout(() => {
      setupSubscription();
    }, 100);

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (channel) {
        channel.untrack().catch(() => {});
        supabase.removeChannel(channel);
      }
      channelRef.current = null;

      // Reset presence state on unmount
      const store = useGamesStore.getState();
      store.setPartnerOnScreen(false);
      store.setPartnerReady(false);
      store.setMyReady(false);
    };
  }, [user?.id, couple?.id, partner?.nickname, isConnected]);

  return null;
}

export default GamesRealtimeListener;
