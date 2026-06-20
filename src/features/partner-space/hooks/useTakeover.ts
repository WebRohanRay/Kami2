import { useEffect, useRef, useCallback } from 'react';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import { TAKEOVER_DURATION_SECONDS } from '../types';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';

/**
 * Manages the 30-second Widget Takeover timer.
 * Handles countdown, auto-save on completion, and cleanup.
 */
export function useTakeover() {
  const space = usePartnerSpaceStore((s) => s.space);
  const items = usePartnerSpaceStore((s) => s.items);
  const takeoverTimerActive = usePartnerSpaceStore((s) => s.takeoverTimerActive);
  const takeoverSecondsLeft = usePartnerSpaceStore((s) => s.takeoverSecondsLeft);
  const setTakeoverSecondsLeft = usePartnerSpaceStore((s) => s.setTakeoverSecondsLeft);
  const setTakeoverTimerActive = usePartnerSpaceStore((s) => s.setTakeoverTimerActive);
  const setSpace = usePartnerSpaceStore((s) => s.setSpace);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start takeover
  const startTakeover = useCallback(async () => {
    if (!space?.id) return false;

    const res = await SpaceService.startTakeover(space.id);
    if (!res.success) return false;

    setSpace(res.data);
    setTakeoverSecondsLeft(TAKEOVER_DURATION_SECONDS);
    setTakeoverTimerActive(true);
    return true;
  }, [space?.id, setSpace, setTakeoverSecondsLeft, setTakeoverTimerActive]);

  // End takeover (manual or auto)
  const endTakeover = useCallback(async () => {
    if (!space?.id) return;

    // Auto-save snapshot
    await SpaceService.createSnapshot(
      space.id,
      items,
      space.nickname,
      space.theme,
      'takeover'
    );

    // End takeover on server
    const res = await SpaceService.endTakeover(space.id);
    if (res.success) {
      setSpace(res.data);
    }

    setTakeoverTimerActive(false);
    setTakeoverSecondsLeft(0);
  }, [space?.id, space?.nickname, space?.theme, items, setSpace, setTakeoverSecondsLeft, setTakeoverTimerActive]);

  // Countdown timer
  useEffect(() => {
    if (!takeoverTimerActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const current = usePartnerSpaceStore.getState().takeoverSecondsLeft;
      if (current <= 1) {
        // Timer done — auto-save and end
        endTakeover();
      } else {
        setTakeoverSecondsLeft(current - 1);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [takeoverTimerActive, endTakeover]);

  return {
    isActive: takeoverTimerActive || (space?.takeoverActive ?? false),
    secondsLeft: takeoverSecondsLeft,
    startTakeover,
    endTakeover,
  };
}
