import React, { useEffect } from 'react';
import { useAuthStore } from '@features/auth';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import { supabase } from '@shared/lib/supabase';
import type { PartnerSpaceItem } from '../types';
import { syncPartnerSpaceWidgetFromStore } from '../hooks/partnerSpaceWidgetSync';

/**
 * Supabase Realtime listener for Partner Space tables.
 * Subscribes to:
 *  - partner_space_items (INSERT, UPDATE, DELETE)
 *  - partner_spaces (UPDATE — goodnight, takeover state)
 *
 * Renders nothing. Mount this inside the Partner Space navigator.
 */
export function PartnerSpaceRealtimeListener() {
  const user = useAuthStore((s) => s.user);
  const partner = useCoupleStore((s) => s.partner);
  const myNickname = user?.nickname;
  const space = usePartnerSpaceStore((s) => s.space);

  useEffect(() => {
    if (!user?.id || !space?.id) return;

    const spaceId = space.id;
    const partnerName = partner?.nickname || 'Partner';
    let channel: any = null;
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupSubscription = () => {
      const channelName = `partner_space_realtime_${spaceId}`;

      // Clean up any existing channel with this name
      try {
        const existing = supabase.getChannels().find(
          (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }
      } catch (e) {
        console.warn('[PartnerSpaceRealtimeListener] Failed to clean up existing channel:', e);
      }

      channel = supabase.channel(channelName)
        // ── Items: INSERT, UPDATE, DELETE ───────────────────────────
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'partner_space_items',
          filter: `space_id=eq.${spaceId}`,
        }, (payload) => {
          const store = usePartnerSpaceStore.getState();

          if (payload.eventType === 'DELETE') {
            store.removeItem(payload.old.id);
            syncPartnerSpaceWidgetFromStore();
            return;
          }

          const row = payload.new as any;
          const isMe = row.added_by === user.id;

          // BUG 2 FIX: Populate addedByNickname from store data
          // (Realtime payloads don't include joined profile data)
          const addedByNickname = isMe
            ? (myNickname || 'You')
            : (partnerName || undefined);

          const mapped: PartnerSpaceItem = {
            id: row.id,
            spaceId: row.space_id,
            addedBy: row.added_by,
            type: row.type,
            content: row.content || {},
            positionX: row.position_x ?? 0,
            positionY: row.position_y ?? 0,
            width: row.width ?? 100,
            height: row.height ?? 100,
            rotation: row.rotation ?? 0,
            zIndex: row.z_index ?? 0,
            isHidden: row.is_hidden ?? false,
            isDeleted: row.is_deleted ?? false,
            reactionEmoji: row.reaction_emoji,
            reactedBy: row.reacted_by,
            disappearCondition: row.disappear_condition,
            disappearAt: row.disappear_at,
            disappeared: row.disappeared ?? false,
            isGiftOpened: row.is_gift_opened ?? false,
            scheduledAt: row.scheduled_at,
            isScheduledPublished: row.is_scheduled_published ?? true,
            seenAt: row.seen_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            addedByNickname,
          };

          // Handle soft-deleted or disappeared items
          if (mapped.isDeleted || mapped.disappeared) {
            store.removeItem(mapped.id);
            syncPartnerSpaceWidgetFromStore();
            return;
          }

          const prevItem = store.items.find((i) => i.id === mapped.id);
          const exists = !!prevItem;

          // BUG 5 FIX: Skip Realtime echoes of own writes.
          // If the item already exists and the incoming updatedAt is not
          // newer, this is a stale echo of our own optimistic update.
          if (exists && prevItem && isMe) {
            const incomingTs = new Date(mapped.updatedAt).getTime();
            const existingTs = new Date(prevItem.updatedAt).getTime();
            if (incomingTs <= existingTs) {
              // Stale echo — skip to avoid flicker
              return;
            }
          }

          if (exists) {
            store.updateItem(mapped);
          } else {
            store.addItem(mapped);
          }

          // Show presence + notification dot for partner's actions
          if (!isMe && payload.eventType === 'INSERT') {
            store.setHasNewUpdate(true);
            store.setNewUpdateDot(true);

            // Haptic feedback would go here in production:
            // import * as Haptics from 'expo-haptics';
            // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            store.setToast({
              title: mapped.type === 'gift' ? 'A surprise appeared! 🎁' : 'Something new! ✨',
              message: `${partnerName} left something on your widget.`,
              icon: mapped.type === 'gift' ? '🎁' : '💌',
            });
          }

          // If item just got a reaction from partner, show toast
          const isNewReaction = row.reaction_emoji && (!prevItem || prevItem.reactionEmoji !== row.reaction_emoji);
          const wasReactedByPartner = row.reacted_by && row.reacted_by !== user.id;

          if (isNewReaction && wasReactedByPartner) {
            store.setToast({
              title: 'They reacted! ❤️',
              message: `${partnerName} reacted ${row.reaction_emoji} to your item.`,
              icon: row.reaction_emoji || '❤️',
            });
          }
          syncPartnerSpaceWidgetFromStore();
        })

        // ── Space metadata: goodnight and widget settings ────────────────────
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'partner_spaces',
          filter: `id=eq.${spaceId}`,
        }, (payload) => {
          const store = usePartnerSpaceStore.getState();
          const row = payload.new as any;
          const wasGoodnightActive = store.space?.goodnightActive;

          store.setSpace({
            ...store.space!,
            goodnightActive: row.goodnight_active ?? false,
            goodnightMessage: row.goodnight_message,
            goodnightActivatedAt: row.goodnight_activated_at,
            takeoverActive: row.takeover_active ?? false,
            takeoverStartedAt: row.takeover_started_at,
            takeoverBy: row.takeover_by,
            nickname: row.nickname || store.space!.nickname,
            theme: row.theme || store.space!.theme,
            widgetSize: row.widget_size || store.space!.widgetSize,
            customColor: row.custom_color,
            timeMoodEnabled: row.time_mood_enabled ?? true,
            updatedAt: row.updated_at,
          });

          // BUG 4 FIX: Only show goodnight toast to the partner, not the activator.
          // If we already had goodnightActive=true in our local store before
          // the Realtime event, it means WE activated it (optimistic update).
          const isNewGoodnight = row.goodnight_active && !wasGoodnightActive;
          if (isNewGoodnight) {
            store.setToast({
              title: 'Goodnight 🌙',
              message: row.goodnight_message || 'Sweet dreams, love 🌙',
              icon: '🌙',
            });
          }
          syncPartnerSpaceWidgetFromStore();
        })

        .subscribe();

      usePartnerSpaceStore.getState();
    };

    // Debounce setup to avoid rapid reconnections
    debounceTimeout = setTimeout(() => {
      setupSubscription();
    }, 100);

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [space?.id, user?.id, user?.nickname, partner?.nickname]);

  // Render nothing
  return null;
}
