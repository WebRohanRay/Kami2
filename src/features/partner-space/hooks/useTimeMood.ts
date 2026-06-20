import { useEffect, useRef } from 'react';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import type { TimeMood } from '../types';
import { TIME_MOOD_CONFIG } from '../types';

/**
 * Detects the current time-of-day mood and updates the store.
 * Re-evaluates every 5 minutes.
 */
export function useTimeMood() {
  const setCurrentTimeMood = usePartnerSpaceStore((s) => s.setCurrentTimeMood);
  const timeMoodEnabled = usePartnerSpaceStore((s) => s.space?.timeMoodEnabled ?? true);
  const currentMood = usePartnerSpaceStore((s) => s.currentTimeMood);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const detectMood = (): TimeMood => {
      const hour = new Date().getHours();

      if (hour >= TIME_MOOD_CONFIG.morning.startHour && hour < TIME_MOOD_CONFIG.morning.endHour) {
        return 'morning';
      }
      if (hour >= TIME_MOOD_CONFIG.afternoon.startHour && hour < TIME_MOOD_CONFIG.afternoon.endHour) {
        return 'afternoon';
      }
      if (hour >= TIME_MOOD_CONFIG.evening.startHour && hour < TIME_MOOD_CONFIG.evening.endHour) {
        return 'evening';
      }
      return 'night';
    };

    const update = () => {
      if (timeMoodEnabled) {
        const nextMood = detectMood();
        if (usePartnerSpaceStore.getState().currentTimeMood !== nextMood) {
          setCurrentTimeMood(nextMood);
        }
      }
    };

    update();

    // Check every 5 minutes
    intervalRef.current = setInterval(update, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeMoodEnabled, setCurrentTimeMood]);

  return {
    currentMood,
    config: TIME_MOOD_CONFIG[currentMood],
    isEnabled: timeMoodEnabled,
  };
}
