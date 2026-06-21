import { useEffect, useMemo } from 'react';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import { PRESENCE_MESSAGES } from '../types';

/**
 * Formats partner's last action into a romantic presence message.
 * Updates whenever new items arrive via realtime.
 */
export function usePresence() {
  const items = usePartnerSpaceStore((s) => s.items);
  const myUserId = usePartnerSpaceStore((s) => s.myUserId);
  const space = usePartnerSpaceStore((s) => s.space);
  const setPartnerPresenceText = usePartnerSpaceStore((s) => s.setPartnerPresenceText);
  const setPartnerLastActionAt = usePartnerSpaceStore((s) => s.setPartnerLastActionAt);
  const presenceText = usePartnerSpaceStore((s) => s.partnerPresenceText);
  // BUG 12 FIX: Subscribe via hook selector instead of getState() in render
  const partnerLastActionAt = usePartnerSpaceStore((s) => s.partnerLastActionAt);

  const latestPartnerAction = useMemo(() => {
    // Find the most recent item added by partner (not by me)
    const partnerItems = items
      .filter((i) => i.addedBy !== myUserId && !i.isDeleted)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return partnerItems[0] || null;
  }, [items, myUserId]);

  useEffect(() => {
    if (!latestPartnerAction) {
      if (presenceText !== null) setPartnerPresenceText(null);
      if (partnerLastActionAt !== null) setPartnerLastActionAt(null);
      return;
    }

    const actionTime = new Date(latestPartnerAction.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - actionTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Don't show presence if action was more than 7 days ago
    if (diffDays > 7) {
      if (presenceText !== null) setPartnerPresenceText(null);
      if (partnerLastActionAt !== null) setPartnerLastActionAt(null);
      return;
    }

    // Format relative time
    let timeStr: string;
    if (diffMins < 1) timeStr = 'just now';
    else if (diffMins < 60) timeStr = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    else if (diffHours < 24) timeStr = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else timeStr = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    // Pick the right message template
    let template: string;
    if (latestPartnerAction.disappearCondition) {
      template = PRESENCE_MESSAGES.disappearing;
    } else if (!latestPartnerAction.isScheduledPublished) {
      template = PRESENCE_MESSAGES.scheduled;
    } else if (latestPartnerAction.type === 'gift') {
      template = PRESENCE_MESSAGES.gift;
    } else {
      template = PRESENCE_MESSAGES[latestPartnerAction.type] || PRESENCE_MESSAGES.generic;
    }

    const text = template.replace('{time}', timeStr);
    if (presenceText !== text) setPartnerPresenceText(text);
    if (partnerLastActionAt !== latestPartnerAction.updatedAt) {
      setPartnerLastActionAt(latestPartnerAction.updatedAt);
    }
  }, [latestPartnerAction, myUserId, presenceText, partnerLastActionAt, setPartnerLastActionAt, setPartnerPresenceText]);

  // Check goodnight status
  const goodnightPresence = useMemo(() => {
    if (space?.goodnightActive) {
      return PRESENCE_MESSAGES.goodnight;
    }
    return null;
  }, [space?.goodnightActive]);

  return {
    presenceText: goodnightPresence || presenceText,
    lastActionAt: partnerLastActionAt,
    hasRecentActivity: !!latestPartnerAction,
  };
}
