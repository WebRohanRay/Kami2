import { useEffect, useRef } from 'react';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';

/**
 * Client-side processor for disappearing items.
 *
 * Runs every 60 seconds and:
 * 1. Calls RPC `process_disappearing_items` to handle after_24h items server-side
 * 2. Locally checks for `after_seen` items where `seenAt` is set
 * 3. Handles `after_reacted` in the reaction handler (not here)
 */
export function useDisappearingItemsProcessor() {
  const spaceId = usePartnerSpaceStore((s) => s.space?.id);
  // BUG 3 FIX: Removed `items` subscription — the processor reads fresh
  // state via getState() inside the callback. Subscribing here caused
  // the interval to restart on every item change.
  const myUserId = usePartnerSpaceStore((s) => s.myUserId);
  const removeItem = usePartnerSpaceStore((s) => s.removeItem);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const processLocalDisappearing = async () => {
      if (!spaceId || !myUserId || processingRef.current) return;
      processingRef.current = true;

      try {
      // 1. Server-side: process after_24h items
      await SpaceService.processDisappearingItems();
      await SpaceService.publishDueDrops();

      // 2. Client-side: process after_seen items
      const storeItems = usePartnerSpaceStore.getState().items;
      for (const item of storeItems) {
        if (
          item.disappearCondition === 'after_seen' &&
          !item.disappeared &&
          !item.isDeleted &&
          item.seenAt &&
          item.addedBy !== myUserId // Only disappear items that I (owner) have seen
        ) {
          // Give a 5-second grace period after being seen
          const seenTime = new Date(item.seenAt).getTime();
          const now = Date.now();
          if (now - seenTime > 5000) {
            await SpaceService.markItemDisappeared(item.id);
            removeItem(item.id);
          }
        }
      }

      // 3. Also reset goodnight mode if it's been more than a day
      await SpaceService.resetGoodnightMode();
      } finally {
        processingRef.current = false;
      }
    };

    // Run immediately on mount
    processLocalDisappearing();

    // Run every 60 seconds
    intervalRef.current = setInterval(processLocalDisappearing, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [myUserId, removeItem, spaceId]);
}
