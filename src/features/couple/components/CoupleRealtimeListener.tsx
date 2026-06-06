import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useAuthStore } from '@features/auth';
import { useCoupleStore } from '../store/coupleStore';
import { useCouple } from '../hooks/useCouple';
import { supabase } from '@shared/lib/supabase';
import { Colors, FontFamily, FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { navigationRef } from '@core/navigation';

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

  useEffect(() => {
    if (activeSpace !== 'couple' || !couple?.id || !user?.id) return;

    const coupleId = couple.id;
    const partnerName = partner?.nickname || 'Your partner';

    // Set up Supabase realtime channel for this couple space
    const channel = supabase.channel(`couple_space_realtime_${coupleId}`)
      // 1. Couple Letters
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'couple_letters', 
        filter: `couple_id=eq.${coupleId}` 
      }, (payload) => {
        loadLetters();
        const newRow = payload.new as any;
        if (payload.eventType === 'INSERT' && newRow.sender_id !== user.id) {
          setToast({
            title: 'New Love Letter! ✉️',
            message: `${partnerName} sealed a new letter for you.`,
            icon: '✉️',
            targetScreen: 'Future'
          });
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
        }
      })
      // 2. Couple Journals
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'couple_journals', 
        filter: `couple_id=eq.${coupleId}` 
      }, (payload) => {
        loadJournals();
        const newRow = payload.new as any;
        if (payload.eventType === 'INSERT' && newRow.user_id !== user.id) {
          setToast({
            title: 'New Journal Entry! 📓',
            message: `${partnerName} wrote a new entry in your journal.`,
            icon: '📓',
            targetScreen: 'Journal'
          });
        }
      })
      // 3. Couple Comments
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'couple_journal_comments' 
      }, (payload) => {
        const newRow = payload.new as any;
        if (newRow && newRow.user_id === partner?.id) {
          loadJournals();
          if (payload.eventType === 'INSERT') {
            setToast({
              title: 'New Comment! 💬',
              message: `${partnerName} commented on a journal entry.`,
              icon: '💬',
              targetScreen: 'Journal'
            });
          }
        }
      })
      // 4. Couple Reactions
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'couple_journal_reactions' 
      }, (payload) => {
        const newRow = payload.new as any;
        if (newRow && newRow.user_id === partner?.id) {
          loadJournals();
        }
      })
      // 5. Couple Goals
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'couple_goals', 
        filter: `couple_id=eq.${coupleId}` 
      }, (payload) => {
        loadGoals();
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        if (payload.eventType === 'INSERT') {
          setToast({
            title: 'New Couple Goal! 🎯',
            message: `A new shared goal has been added.`,
            icon: '🎯',
            targetScreen: 'Goals'
          });
        } else if (payload.eventType === 'UPDATE') {
          if (oldRow && oldRow.progress !== newRow.progress) {
            setToast({
              title: 'Goal Updated! 📈',
              message: `Goal progress has been changed to ${newRow.progress}%.`,
              icon: '📈',
              targetScreen: 'Goals'
            });
          }
        }
      })
      // 6. Couple Memories
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'couple_memories', 
        filter: `couple_id=eq.${coupleId}` 
      }, (payload) => {
        loadMemories();
        if (payload.eventType === 'INSERT') {
          setToast({
            title: 'New Memory Card! 📸',
            message: `${partnerName} added a new memory to your timeline.`,
            icon: '📸',
            targetScreen: 'Memories'
          });
        }
      })
      // 7. Couple Answers
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'couple_answers', 
        filter: `couple_id=eq.${coupleId}` 
      }, (payload) => {
        loadDailyQuestion();
        const newRow = payload.new as any;
        if (payload.eventType === 'INSERT' && newRow.user_id !== user.id) {
          setToast({
            title: 'New Answer! 💭',
            message: `${partnerName} answered today's question.`,
            icon: '💭',
            targetScreen: 'Home'
          });
        }
      })
      // 8. Relationship Events (Calendar)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'relationship_events', 
        filter: `couple_id=eq.${coupleId}` 
      }, (payload) => {
        loadEvents();
        const newRow = payload.new as any;
        if (payload.eventType === 'INSERT') {
          setToast({
            title: 'Event Scheduled! 📅',
            message: `New calendar event: "${newRow.title}".`,
            icon: '📅',
            targetScreen: 'Home'
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSpace, couple?.id, partner?.id, user?.id]);

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
