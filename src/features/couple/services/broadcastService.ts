import { useCoupleStore, PartnerActionType } from '../store/coupleStore';
import { supabase } from '@shared/lib/supabase';

export async function broadcastPartnerAction(coupleId: string, userId: string, action: PartnerActionType) {
  const channel = useCoupleStore.getState().realtimeChannel;
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'presence_action',
      payload: { userId, action }
    });
  } else {
    const channelName = `couple_space_realtime_${coupleId}`;
    const ch = supabase.channel(channelName);
    const sendAction = () => {
      ch.send({
        type: 'broadcast',
        event: 'presence_action',
        payload: { userId, action }
      });
    };
    if ((ch as any).state === 'joined') {
      sendAction();
    } else {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          sendAction();
        }
      });
    }
  }
}
