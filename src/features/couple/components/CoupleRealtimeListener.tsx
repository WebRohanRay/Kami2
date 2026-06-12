import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useAuthStore } from '@features/auth';
import { useCoupleStore, PartnerActionType } from '../store/coupleStore';
import { useCouple } from '../hooks/useCouple';
import { supabase } from '@shared/lib/supabase';
import { Colors, FontFamily, FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { navigationRef } from '@core/navigation/navigationRef';
import { triggerLocalNotificationAsync } from '@infrastructure/notifications/notificationService';
import { resolveAvatarUrl, fetchProfileNickname } from '@infrastructure/profile';
import { resolveSignedUrls } from '@shared/lib/storage';
import type { 
  CoupleLetter, CoupleJournal, CoupleMemory, CoupleGoal, CoupleAnswer, RelationshipEvent, CoupleComment 
} from '../types';
import { useNetworkStatus } from '@shared/network/NetworkProvider';

export function CoupleRealtimeListener() {
  const user = useAuthStore(s => s.user);
  const couple = useCoupleStore(s => s.couple);
  const partner = useCoupleStore(s => s.partner);
  const activeSpace = user?.activeSpace ?? 'personal';
  const toast = useCoupleStore(s => s.toast);
  const setToast = useCoupleStore(s => s.setToast);

  const {
    loadJournals,
    loadGoals,
    loadLetters,
    loadMemories,
    loadDailyQuestion,
    loadEvents
  } = useCouple();

  const { isConnected } = useNetworkStatus();

  useEffect(() => {
    if (activeSpace !== 'couple' || !couple?.id || !user?.id) return;

    if (!isConnected) {
      return;
    }

    const coupleId = couple.id;
    const partnerName = partner?.nickname || 'Your partner';

    let channel: any = null;
    let debounceTimeout: NodeJS.Timeout | null = null;

    const setupSubscription = () => {
      const channelName = `couple_space_realtime_${coupleId}`;
      try {
        const existing = supabase.getChannels().find(
          (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }
      } catch (e) {
        console.warn('[CoupleRealtimeListener] Failed to clean up existing channel:', e);
      }

      channel = supabase.channel(channelName)
        // Broadcast listener for ephemeral action presence (writing letter, reading memories, etc.)
        .on('broadcast', { event: 'presence_action' }, (payload: any) => {
          if (payload?.payload?.userId !== user.id) {
            useCoupleStore.getState().setPartnerAction(payload.payload.action);
          }
        })
        // 1. Couple Letters
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_letters', 
          filter: `couple_id=eq.${coupleId}` 
        }, async (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            store.removeCoupleLetterFromList(payload.old.id);
          } else {
            const newRow = payload.new as any;
            const resolvedImages = newRow.image_urls && newRow.image_urls.length > 0 
              ? await resolveSignedUrls('couple_letter_images', newRow.image_urls) 
              : [];
            const mapped: CoupleLetter = {
              id: newRow.id,
              coupleId: newRow.couple_id,
              senderId: newRow.sender_id,
              subject: newRow.subject,
              body: newRow.body || null,
              deliverAt: newRow.deliver_at,
              isUnlocked: Date.now() >= new Date(newRow.deliver_at).getTime(),
              createdAt: newRow.created_at,
              senderNickname: newRow.sender_id === user?.id ? 'You' : (partner?.nickname || 'Partner'),
              isRead: newRow.is_read,
              isFavorite: newRow.is_favorite,
              isDraft: newRow.is_draft,
              isArchived: newRow.is_archived,
              parentLetterId: newRow.parent_letter_id,
              deliveredAt: newRow.delivered_at,
              readAt: newRow.read_at,
              updatedAt: newRow.updated_at,
              imageUrls: resolvedImages,
              reactions: (newRow.reactions || []).map((rx: any) => ({
                userId: rx.user_id,
                emoji: rx.emoji
              }))
            };
            const exists = store.coupleLetters.some(x => x.id === mapped.id);
            if (exists) {
              store.updateCoupleLetterInList(mapped);
            } else {
              store.prependCoupleLetter(mapped);
            }

            if (payload.eventType === 'INSERT' && newRow.sender_id !== user.id) {
              setToast({
                title: 'New Love Letter! ✉️',
                message: `${partnerName} sealed a new letter for you.`,
                icon: '✉️',
                targetScreen: 'Future'
              });
              store.addHomeAlert({
                type: 'letter',
                title: 'New Letter Received 💌',
                message: `${partnerName} just sent you a letter!`,
                targetScreen: 'Future'
              });
              triggerLocalNotificationAsync(
                'A secret letter arrived! 💌',
                `"${partnerName} sealed a new time capsule for you. Open it to feel all the butterflies! 🦋"`,
                { screen: 'Future' }
              );
              Alert.alert(
                'New Love Letter! ✉️',
                `${partnerName} just sealed a new love letter for you.`,
                [
                  { text: 'Dismiss', style: 'cancel' },
                  {
                    text: 'View Letters',
                    onPress: () => {
                      navigationRef.current?.navigate('Future' as any);
                    }
                  }
                ]
              );
            } else if (payload.eventType === 'UPDATE' && newRow.is_read && newRow.sender_id === user.id) {
              setToast({
                title: 'Letter Read! ❤️',
                message: `${partnerName} read your love letter.`,
                icon: '❤️',
                targetScreen: 'Future'
              });
              store.addHomeAlert({
                type: 'reaction',
                title: 'Letter Read ❤️',
                message: `${partnerName} opened your letter!`,
                targetScreen: 'Future'
              });
              triggerLocalNotificationAsync(
                'Letter read! ❤️',
                `"${partnerName} just opened your love letter! They are probably smiling right now. 🥰"`,
                { screen: 'Future' }
              );
            }
          }
        })
        // 2. Couple Journals
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_journals', 
          filter: `couple_id=eq.${coupleId}` 
        }, async (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            store.removeCoupleJournalFromList(payload.old.id);
          } else {
            const newRow = payload.new as any;
            const resolvedImages = newRow.image_urls && newRow.image_urls.length > 0
              ? await resolveSignedUrls('couple_journal_images', newRow.image_urls)
              : [];
            const isMe = newRow.user_id === user?.id;
            const mapped: CoupleJournal = {
              id: newRow.id,
              coupleId: newRow.couple_id,
              userId: newRow.user_id,
              title: newRow.title || null,
              body: newRow.body,
              moodId: newRow.mood_id || null,
              imageUrls: resolvedImages,
              tags: newRow.tags || [],
              entryDate: newRow.entry_date,
              isPinned: !!newRow.is_pinned,
              createdAt: newRow.created_at,
              updatedAt: newRow.updated_at,
              userNickname: isMe ? (user?.nickname || 'You') : (partner?.nickname || 'Partner'),
              userAvatarUrl: isMe ? (user?.avatarUrl || undefined) : (partner?.avatarUrl || undefined),
              comments: [],
              reactions: []
            };
            const existing = store.coupleJournals.find(x => x.id === mapped.id);
            if (existing) {
              mapped.comments = existing.comments;
              mapped.reactions = existing.reactions;
              store.updateCoupleJournalInList(mapped);
            } else {
              store.prependCoupleJournal(mapped);
            }

            if (payload.eventType === 'INSERT' && newRow.user_id !== user.id) {
              setToast({
                title: 'New Journal Entry! 📓',
                message: `${partnerName} wrote a new entry in your journal.`,
                icon: '📓',
                targetScreen: 'Journal'
              });
              triggerLocalNotificationAsync(
                'Our story grows! 📓',
                `"${partnerName} wrote a new entry in our journal: go read what they shared! ✨"`,
                { screen: 'Journal' }
              );
            } else if (payload.eventType === 'UPDATE' && newRow.user_id !== user.id) {
              setToast({
                title: 'Journal Entry Updated! 📓',
                message: `${partnerName} updated a journal entry.`,
                icon: '📓',
                targetScreen: 'Journal'
              });
              triggerLocalNotificationAsync(
                'Journal entry updated! 📓',
                `"${partnerName} updated an entry in our journal: '${newRow.title || 'Untitled'}'. ✨"`,
                { screen: 'Journal' }
              );
            }
          }
        })
        // 3. Couple Comments
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_journal_comments' 
        }, (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any;
            if (oldRow) {
              const targetJournal = store.coupleJournals.find(j => (j.comments ?? []).some(c => c.id === oldRow.id));
              if (targetJournal) {
                const updatedJournal = {
                  ...targetJournal,
                  comments: (targetJournal.comments ?? []).filter(c => c.id !== oldRow.id)
                };
                store.updateCoupleJournalInList(updatedJournal);
              }
            }
          } else {
            const newRow = payload.new as any;
            if (newRow) {
              const targetJournal = store.coupleJournals.find(x => x.id === newRow.entry_id);
              if (targetJournal) {
                const isMe = newRow.user_id === user?.id;
                const newComment: CoupleComment = {
                  id: newRow.id,
                  entryId: newRow.entry_id,
                  userId: newRow.user_id,
                  body: newRow.body,
                  createdAt: newRow.created_at,
                  userNickname: isMe ? (user?.nickname || 'You') : (partner?.nickname || 'Partner'),
                  userAvatarUrl: isMe ? (user?.avatarUrl || undefined) : (partner?.avatarUrl || undefined),
                };
                const hasComment = (targetJournal.comments ?? []).some(c => c.id === newComment.id);
                if (!hasComment) {
                  const updatedJournal = {
                    ...targetJournal,
                    comments: [...(targetJournal.comments ?? []), newComment]
                  };
                  store.updateCoupleJournalInList(updatedJournal);
                }
              }
              if (newRow.user_id === partner?.id && payload.eventType === 'INSERT') {
                setToast({
                  title: 'New Comment! 💬',
                  message: `${partnerName} commented on a journal entry.`,
                  icon: '💬',
                  targetScreen: 'Journal'
                });
                triggerLocalNotificationAsync(
                  'A sweet whisper! 💬',
                  `"${partnerName} left a comment on your journal entry. Go check it out! 😘"`,
                  { screen: 'Journal' }
                );
              }
            }
          }
        })
        // 4. Couple Reactions
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_journal_reactions' 
        }, (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any;
            if (oldRow) {
              const targetJournal = store.coupleJournals.find(x => x.id === oldRow.entry_id);
              if (targetJournal) {
                const updatedJournal = {
                  ...targetJournal,
                  reactions: (targetJournal.reactions ?? []).filter(r => !(r.userId === oldRow.user_id && r.emoji === oldRow.emoji))
                };
                store.updateCoupleJournalInList(updatedJournal);
              }
            }
          } else {
            const newRow = payload.new as any;
            if (newRow) {
              const targetJournal = store.coupleJournals.find(x => x.id === newRow.entry_id);
              if (targetJournal) {
                const newReaction = {
                  entryId: newRow.entry_id,
                  userId: newRow.user_id,
                  emoji: newRow.emoji
                };
                const hasReaction = (targetJournal.reactions ?? []).some(r => r.userId === newReaction.userId && r.emoji === newReaction.emoji);
                if (!hasReaction) {
                  const updatedJournal = {
                    ...targetJournal,
                    reactions: [...(targetJournal.reactions ?? []), newReaction]
                  };
                  store.updateCoupleJournalInList(updatedJournal);
                }
              }
              if (newRow.user_id === partner?.id && payload.eventType === 'INSERT') {
                setToast({
                  title: 'Partner Reacted! ❤️',
                  message: `${partnerName} reacted to a journal entry.`,
                  icon: '❤️',
                  targetScreen: 'Journal'
                });
                store.addHomeAlert({
                  type: 'reaction',
                  title: 'Partner Reacted ❤️',
                  message: `${partnerName} left a reaction in the journal.`,
                  targetScreen: 'Journal'
                });
                triggerLocalNotificationAsync(
                  'Love is in the air! ❤️',
                  `"${partnerName} reacted to your journal page. Sending you extra hugs! 🥰"`,
                  { screen: 'Journal' }
                );
              }
            }
          }
        })
        // 5. Couple Goals
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_goals', 
          filter: `couple_id=eq.${coupleId}` 
        }, (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            store.removeCoupleGoalFromList(payload.old.id);
          } else {
            const newRow = payload.new as any;
            const oldRow = payload.old as any;
            const mapped: CoupleGoal = {
              id: newRow.id,
              coupleId: newRow.couple_id,
              title: newRow.title,
              description: newRow.description,
              category: newRow.category,
              status: newRow.status,
              progress: newRow.progress,
              targetDate: newRow.target_date,
              completedAt: newRow.completed_at,
              emoji: newRow.emoji,
              createdAt: newRow.created_at,
              updatedAt: newRow.updated_at
            };
            const exists = store.coupleGoals.some(x => x.id === mapped.id);
            if (exists) {
              store.updateCoupleGoalInList(mapped);
            } else {
              store.prependCoupleGoal(mapped);
            }

            if (payload.eventType === 'INSERT') {
              setToast({
                title: 'New Couple Goal! 🎯',
                message: `A new shared goal has been added.`,
                icon: '🎯',
                targetScreen: 'Goals'
              });
              store.addHomeAlert({
                type: 'goal',
                title: 'New Goal Added 🎯',
                message: `A new shared goal has been created!`,
                targetScreen: 'Goals'
              });
              triggerLocalNotificationAsync(
                'New dream unlocked! 🎯',
                `"We just added a new shared goal: let's conquer the world together, one step at a time! 🌱"`,
                { screen: 'Goals' }
              );
            } else if (payload.eventType === 'UPDATE') {
              if (oldRow && oldRow.progress !== newRow.progress) {
                setToast({
                  title: 'Goal Updated! 📈',
                  message: `Goal progress has been changed to ${newRow.progress}%.`,
                  icon: '📈',
                  targetScreen: 'Goals'
                });
                if (newRow.progress === 100) {
                  store.addHomeAlert({
                    type: 'completed_goal',
                    title: 'Goal Completed! 🎉',
                    message: `"${newRow.title}" is fully completed!`,
                    targetScreen: 'Goals'
                  });
                  triggerLocalNotificationAsync(
                    'Goal Completed! 🎉',
                    `"We did it! We finished '${newRow.title}'. Time to celebrate with a big kiss! 😘"`,
                    { screen: 'Goals' }
                  );
                } else {
                  triggerLocalNotificationAsync(
                    "We're getting closer! 📈",
                    `"Teamwork makes the dream work! Progress on '${newRow.title}' is now ${newRow.progress}%! 🌸"`,
                    { screen: 'Goals' }
                  );
                }
              }
            }
          }
        })
        // 6. Couple Memories
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_memories', 
          filter: `couple_id=eq.${coupleId}` 
        }, async (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            store.removeCoupleMemoryFromList(payload.old.id);
          } else {
            const newRow = payload.new as any;
            const resolvedImages = newRow.image_urls && newRow.image_urls.length > 0
              ? await resolveSignedUrls('couple_memory_images', newRow.image_urls)
              : [];
            const isMe = newRow.last_edited_by === user?.id;
            const mapped: CoupleMemory = {
              id: newRow.id,
              coupleId: newRow.couple_id,
              title: newRow.title,
              description: newRow.description,
              imageUrls: resolvedImages,
              memoryDate: newRow.memory_date,
              tags: newRow.tags || [],
              createdAt: newRow.created_at,
              location: newRow.location || null,
              mood: newRow.mood || null,
              memoryTime: newRow.memory_time || null,
              lastEditedBy: newRow.last_edited_by || null,
              lastEditedNickname: isMe ? (user?.nickname || 'You') : (partner?.nickname || 'Partner')
            };
            const exists = store.coupleMemories.some(x => x.id === mapped.id);
            if (exists) {
              store.updateCoupleMemoryInList(mapped);
            } else {
              store.prependCoupleMemory(mapped);
            }

            if (payload.eventType === 'INSERT') {
              setToast({
                title: 'New Memory Card! 📸',
                message: `${partnerName} added a new memory to your timeline.`,
                icon: '📸',
                targetScreen: 'Memories'
              });
              store.addHomeAlert({
                type: 'memory',
                title: 'New Memory Added 📝',
                message: `${partnerName} added a new memory to your timeline.`,
                targetScreen: 'Memories'
              });
              triggerLocalNotificationAsync(
                'Look at us being cute! 📸',
                `"${partnerName} added a new memory to our wall: '${newRow.title}'. Let's keep making milestones! 🥰"`,
                { screen: 'Memories' }
              );
            } else if (payload.eventType === 'UPDATE') {
              setToast({
                title: 'Memory Updated! 📸',
                message: `${partnerName} updated a memory: "${newRow.title}".`,
                icon: '📸',
                targetScreen: 'Memories'
              });
              triggerLocalNotificationAsync(
                'Memory updated! 📸',
                `"${partnerName} updated the memory '${newRow.title}' on our timeline. Check out what changed! 🥰"`,
                { screen: 'Memories' }
              );
            }
          }
        })
        // 7. Couple Answers
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_answers', 
          filter: `couple_id=eq.${coupleId}` 
        }, (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any;
            if (oldRow) {
              store.setDailyAnswers(store.dailyAnswers.filter(x => x.id !== oldRow.id));
            }
          } else {
            const newRow = payload.new as any;
            const isMe = newRow.user_id === user?.id;
            const mappedAnswer: CoupleAnswer = {
              id: newRow.id,
              questionId: newRow.question_id,
              coupleId: newRow.couple_id,
              userId: newRow.user_id,
              response: newRow.response,
              createdAt: newRow.created_at,
              userNickname: isMe ? (user?.nickname || 'You') : (partner?.nickname || 'Partner')
            };
            store.addDailyAnswer(mappedAnswer);

            if (payload.eventType === 'INSERT' && newRow.user_id !== user.id) {
              const hasUserAnswered = store.dailyAnswers.some(a => a.userId === user.id);
              setToast({
                title: 'Partner Answered! 💭',
                message: hasUserAnswered ? `${partnerName} answered today's question. Go read it!` : `${partnerName} answered today's question.`,
                icon: '💭',
                targetScreen: 'Home'
              });
              triggerLocalNotificationAsync(
                hasUserAnswered ? 'Answer Unlocked! 💭' : 'A secret revealed! 💭',
                hasUserAnswered 
                  ? `"${partnerName} answered today's question! Tap to read their response. 🥰"`
                  : `"${partnerName} answered today's question! Type your answer to unlock theirs! 😉"`,
                { screen: 'Home' }
              );
            }
          }
        })
        // 8. Relationship Events (Calendar)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'relationship_events', 
          filter: `couple_id=eq.${coupleId}` 
        }, (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any;
            if (oldRow) {
              store.setRelationshipEvents(store.relationshipEvents.filter(x => x.id !== oldRow.id));
            }
          } else {
            const newRow = payload.new as any;
            const mapped: RelationshipEvent = {
              id: newRow.id,
              coupleId: newRow.couple_id,
              title: newRow.title,
              description: newRow.description || undefined,
              eventDate: newRow.event_date,
              eventType: newRow.event_type,
              createdAt: newRow.created_at,
              updatedAt: newRow.updated_at || newRow.created_at || new Date().toISOString(),
            };
            if (payload.eventType === 'INSERT') {
              store.prependRelationshipEvent(mapped);
              setToast({
                title: 'Event Scheduled! 📅',
                message: `New calendar event: "${newRow.title}".`,
                icon: '📅',
                targetScreen: 'Home'
              });
              triggerLocalNotificationAsync(
                'Date Night scheduled? 📅',
                `"New countdown: '${newRow.title}' has been added to our calendar! Can't wait! 🥰"`,
                { screen: 'Home' }
              );
            } else if (payload.eventType === 'UPDATE') {
              store.setRelationshipEvents(store.relationshipEvents.map(x => x.id === mapped.id ? mapped : x));
            }
          }
        })
        // 9. Couple Letter Reactions
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'couple_letter_reactions'
        }, (payload) => {
          const store = useCoupleStore.getState();
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as any;
            if (oldRow) {
              const targetLetter = store.coupleLetters.find(x => x.id === oldRow.letter_id);
              if (targetLetter) {
                const updatedLetter = {
                  ...targetLetter,
                  reactions: (targetLetter.reactions ?? []).filter(r => !(r.userId === oldRow.user_id && r.emoji === oldRow.emoji))
                };
                store.updateCoupleLetterInList(updatedLetter);
              }
            }
          } else {
            const newRow = payload.new as any;
            const targetLetter = store.coupleLetters.find(x => x.id === newRow.letter_id);
            if (targetLetter) {
              const newReaction = {
                userId: newRow.user_id,
                emoji: newRow.emoji
              };
              const hasReaction = (targetLetter.reactions ?? []).some(r => r.userId === newReaction.userId && r.emoji === newReaction.emoji);
              if (!hasReaction) {
                const updatedLetter = {
                  ...targetLetter,
                  reactions: [...(targetLetter.reactions ?? []), newReaction]
                };
                store.updateCoupleLetterInList(updatedLetter);
              }
            }
            if (payload.eventType === 'INSERT' && newRow && newRow.user_id !== user.id) {
              setToast({
                title: 'Letter Reaction! ✉️',
                message: `${partnerName} reacted ${newRow.emoji || ''} to your letter.`,
                icon: newRow.emoji || '✉️',
                targetScreen: 'Future'
              });
              triggerLocalNotificationAsync(
                'Sweet reaction! ✉️',
                `"${partnerName} reacted ${newRow.emoji || ''} to your love letter! 🥰"`,
                { screen: 'Future' }
              );
            }
          }
        })
        // 10. Partner Profile Mood Changes
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles', 
          filter: `id=eq.${partner?.id}` 
        }, async (payload) => {
          const p = payload.new as any;
          const resolvedAvatar = await resolveAvatarUrl(p.avatar_url);
          const currentPartner = useCoupleStore.getState().partner;
          
          useCoupleStore.getState().setPartner({
            id: p.id,
            nickname: p.nickname || 'Partner',
            email: p.email || '',
            avatarUrl: resolvedAvatar,
            lastSeenAt: p.last_seen_at,
            currentMoodEmoji: p.current_mood_emoji,
            currentMoodLabel: p.current_mood_label,
          });

          if (p.current_mood_emoji !== currentPartner?.currentMoodEmoji || p.current_mood_label !== currentPartner?.currentMoodLabel) {
            if (p.current_mood_emoji || p.current_mood_label) {
              const moodText = `${p.current_mood_emoji || ''} ${p.current_mood_label || ''}`.trim();
              setToast({
                title: 'Mood Update! 🔮',
                message: `${p.nickname || 'Partner'} is feeling: ${moodText}`,
                icon: p.current_mood_emoji || '🔮',
                targetScreen: 'Home'
              });
              triggerLocalNotificationAsync(
                'Partner Mood Update! 🔮',
                `"${p.nickname || 'Partner'} updated their mood to ${moodText}."`,
                { screen: 'Home' }
              );
            }
          }
        })
        .subscribe();

      useCoupleStore.getState().setRealtimeChannel(channel);
    };

    debounceTimeout = setTimeout(() => {
      setupSubscription();
    }, 2000);

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      useCoupleStore.getState().setRealtimeChannel(null);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [activeSpace, couple?.id, partner?.id, user?.id, isConnected]);

  useEffect(() => {
    if (!user?.id) return;

    if (!isConnected) return;

    let channel: any = null;
    let debounceTimeout: NodeJS.Timeout | null = null;

    const setupSubscription = () => {
      const channelName = `user_invitations_realtime_${user.id}`;
      try {
        const existing = supabase.getChannels().find(
          (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }
      } catch (e) {
        console.warn('[CoupleRealtimeListener] Failed to clean up existing invitation channel:', e);
      }

      channel = supabase.channel(channelName)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'couple_invitations', 
          filter: `receiver_id=eq.${user.id}` 
        }, async (payload) => {
          try {
            const senderId = (payload.new as any).sender_id;
            if (senderId) {
              const senderNickname = await fetchProfileNickname(senderId);
              setToast({
                title: 'Couple Invitation! 💖',
                message: `${senderNickname} sent you a couple invitation.`,
                icon: '💖',
                targetScreen: 'Settings'
              });
              triggerLocalNotificationAsync(
                'Couple Invitation! 💖',
                `"${senderNickname} sent you a couple invitation! Open settings to respond. 🥰"`,
                { screen: 'Settings' }
              );
            }
          } catch (e) {
            console.error('Error handling invitation insert notification:', e);
          }
        })
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'couple_invitations', 
          filter: `sender_id=eq.${user.id}` 
        }, async (payload) => {
          try {
            const newRow = payload.new as any;
            const oldRow = payload.old as any;
            if (newRow.status === 'accepted' && oldRow?.status !== 'accepted') {
              const receiverId = newRow.receiver_id;
              if (receiverId) {
                const receiverNickname = await fetchProfileNickname(receiverId);
                setToast({
                  title: 'Invitation Accepted! 💖',
                  message: `${receiverNickname} accepted your couple invitation.`,
                  icon: '💖',
                  targetScreen: 'Settings'
                });
                triggerLocalNotificationAsync(
                  'Invitation Accepted! 💖',
                  `"${receiverNickname} accepted your couple invitation! Welcome to your shared space. 🥰"`,
                  { screen: 'Settings' }
                );
              }
            } else if (newRow.status === 'declined' && oldRow?.status !== 'declined') {
              const receiverId = newRow.receiver_id;
              if (receiverId) {
                const receiverNickname = await fetchProfileNickname(receiverId);
                setToast({
                  title: 'Invitation Declined 💔',
                  message: `${receiverNickname} declined your couple invitation.`,
                  icon: '💔',
                  targetScreen: 'Settings'
                });
                triggerLocalNotificationAsync(
                  'Invitation Declined 💔',
                  `"${receiverNickname} declined your couple invitation."`,
                  { screen: 'Settings' }
                );
              }
            }
          } catch (e) {
            console.error('Error handling invitation update notification:', e);
          }
        })
        .subscribe();
    };

    debounceTimeout = setTimeout(() => {
      setupSubscription();
    }, 2000);

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, isConnected]);

  return <GlobalToast toast={toast} onClose={() => setToast(null)} />;
}

interface GlobalToastProps {
  toast: { title: string; message: string; icon: string; targetScreen?: string } | null;
  onClose: () => void;
}

const GlobalToast: React.FC<GlobalToastProps> = ({ toast, onClose }) => {
  const transY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (toast) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      Animated.parallel([
        Animated.spring(transY, {
          toValue: 50,
          useNativeDriver: true,
          tension: 40,
          friction: 7
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();

      timeoutRef.current = setTimeout(() => {
        dismiss();
      }, 4000);
    } else {
      Animated.parallel([
        Animated.timing(transY, {
          toValue: -150,
          duration: 250,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [toast]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(transY, {
        toValue: -150,
        duration: 250,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      onClose();
    });
  };

  const handlePress = () => {
    if (toast?.targetScreen) {
      navigationRef.current?.navigate(toast.targetScreen as any);
    }
    dismiss();
  };

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: transY }],
          opacity: opacity,
        }
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.toastCard}>
        <Text style={styles.icon}>{toast.icon}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{toast.title}</Text>
          <Text numberOfLines={2} style={styles.message}>{toast.message}</Text>
        </View>
        {toast.targetScreen && (
          <Text style={styles.chevron}>›</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 999999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: Radii.card,
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
    borderWidth: 1.5,
    borderColor: 'rgba(201, 104, 130, 0.25)', // Primary Rose tint
    ...Shadows.md,
  },
  icon: {
    fontSize: 26,
    marginRight: Space[3],
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  message: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  chevron: {
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    marginLeft: Space[2],
  }
});
