import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Platform, StatusBar as RNStatusBar, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Space, Radii, Shadows, FontSize } from '@shared/constants';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useAuthStore } from '@features/auth';
import { useTheme } from '@shared/hooks';
import type { MainTabScreenProps } from '@core/navigation/types';

export default function TimelineScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  
  // Get all data to build the timeline
  const { coupleLetters, coupleMemories, coupleGoals, coupleJournals, dailyAnswers } = useCoupleStore();

  const dynamicTimeline = useMemo(() => {
    const timeline: any[] = [];
    
    // We recreate the same logic as HomeScreen but keeping it all here
    const getTimeAgo = (dateStr: string) => {
      const diff = Date.now() - new Date(dateStr).getTime();
      const min = Math.floor(diff / 60000);
      const hr = Math.floor(min / 60);
      const d = Math.floor(hr / 24);
      if (d > 0) return `${d}d ago`;
      if (hr > 0) return `${hr}h ago`;
      if (min > 0) return `${min}m ago`;
      return 'Just now';
    };

    const getMemberName = (id: string) => {
      if (id === user?.id) return 'You';
      return 'Partner';
    };

    coupleLetters.forEach((l: any) => {
      if (l.isDraft) return;
      const senderName = getMemberName(l.senderId);
      const isLocked = new Date(l.deliverAt).getTime() > Date.now() && l.senderId !== user?.id;
      timeline.push({
        id: `letter-${l.id}`,
        type: 'letter',
        title: isLocked ? `${senderName} sent a sealed letter 🔒` : `${senderName} sent a letter: "${l.subject || 'No Subject'}"`,
        description: isLocked ? `Unlocks on ${new Date(l.deliverAt).toLocaleDateString(undefined, { timeZone: user?.timezone ?? 'UTC' })}` : l.body?.substring(0, 50) + '...',
        time: getTimeAgo(l.createdAt),
        icon: '✉️',
        date: new Date(l.createdAt)
      });
    });

    coupleMemories.forEach((m: any) => {
      timeline.push({
        id: `memory-${m.id}`,
        type: 'memory',
        title: `New memory shared: "${m.title}"`,
        description: m.description,
        time: getTimeAgo(m.memoryDate || m.createdAt),
        icon: '🌸',
        date: new Date(m.createdAt)
      });
    });

    coupleGoals.forEach((g: any) => {
      timeline.push({
        id: `goal-${g.id}`,
        type: 'goal',
        title: g.status === 'completed' ? `Shared goal completed! 🎉` : `New shared goal set`,
        description: `"${g.title}" - ${g.progress}% complete`,
        time: getTimeAgo(g.completedAt || g.createdAt),
        icon: '🎯',
        date: new Date(g.createdAt)
      });
    });

    coupleJournals.forEach((j: any) => {
      timeline.push({
        id: `journal-${j.id}`,
        type: 'journal',
        title: `${getMemberName(j.userId)} wrote a journal entry`,
        description: j.title || 'Untitled',
        time: getTimeAgo(j.entryDate || j.createdAt),
        icon: '📖',
        date: new Date(j.createdAt)
      });
    });

    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
    return timeline;
  }, [coupleLetters, coupleMemories, coupleGoals, coupleJournals, dailyAnswers, user?.id]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={{ fontSize: 24, color: Colors.textPrimary }}>←</Text>
        </TouchableOpacity>
        <KamiText variant="title">Full Timeline</KamiText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {dynamicTimeline.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>⏳</Text>
            <KamiText variant="body" color={Colors.textMuted}>Your timeline is empty. Make some memories together!</KamiText>
          </View>
        ) : (
          <View style={s.timelineWrap}>
            {dynamicTimeline.map((item, index) => (
              <View key={item.id} style={s.itemRow}>
                <View style={s.leftCol}>
                  <View style={[s.iconCircle, { backgroundColor: colors.creamDeep + '44', borderColor: colors.primaryLight + '33' }]}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  {index < dynamicTimeline.length - 1 && (
                    <View style={[s.line, { backgroundColor: Colors.border + '55' }]} />
                  )}
                </View>
                <View style={s.rightContent}>
                  <View style={s.metaRow}>
                    <KamiText bold style={s.itemTitle} numberOfLines={2}>{item.title}</KamiText>
                    <KamiText style={s.itemTime}>{item.time}</KamiText>
                  </View>
                  {item.description ? (
                    <KamiText style={s.itemDesc} numberOfLines={2}>{item.description}</KamiText>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space[5],
    paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2],
    paddingBottom: Space[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '33',
  },
  scroll: {
    padding: Space[5],
    paddingBottom: Space[10],
  },
  emptyState: {
    paddingVertical: Space[10],
    alignItems: 'center',
  },
  timelineWrap: {
    paddingVertical: Space[2],
  },
  itemRow: {
    flexDirection: 'row',
    gap: Space[3],
    minHeight: 64,
  },
  leftCol: {
    alignItems: 'center',
    width: 38,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    ...Shadows.sm,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  rightContent: {
    flex: 1,
    paddingBottom: Space[4],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Space[2],
  },
  itemTitle: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  itemTime: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
