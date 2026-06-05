import React from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import KamiText from '@shared/ui/atoms/KamiText';
import MemoryCard, { type Memory } from '@shared/ui/molecules/MemoryCard';
import MoodSelector from '@shared/ui/molecules/MoodSelector';
import StreakBadge from '@shared/ui/molecules/StreakBadge';
import { Colors, FontSize, Radii, Shadows, Sizing, Space } from '@shared/constants';
import type { MainTabScreenProps } from '@core/navigation/types';
import { useAuthStore } from '@features/auth';

type Props = MainTabScreenProps<'Home'>;

const SAMPLE_MEMORIES: Memory[] = [
  { id: '1', title: 'First Kami day', date: 'Today',  emoji: '✦' },
  { id: '2', title: 'A quiet promise', date: 'Soon',  emoji: '♡' },
  { id: '3', title: 'Future plans',    date: 'Later', emoji: '→' },
];

const DAILY_PROMPT = 'What made you feel close today?';

function greetingName(nickname: string | undefined, email: string | undefined): string {
  if (nickname?.trim()) return nickname.trim();
  if (email?.includes('@')) return email.split('@')[0];
  return 'there';
}

function initialFor(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'K';
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const user    = useAuthStore((state) => state.user);
  const name    = greetingName(user?.nickname, user?.email);
  const dayNumber = 1;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{initialFor(name)}</Text>
              )}
            </View>
            <View style={styles.headerText}>
              <KamiText variant="overline">Day {dayNumber} in Kami</KamiText>
              <KamiText variant="display" style={styles.title}>
                Good Morning,{'\n'}{name}
              </KamiText>
            </View>
          </View>

          {/* Settings button — navigate to Settings tab */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.streakRow}>
          <StreakBadge count={dayNumber} label="days" />
          <KamiText variant="caption" color={Colors.textMuted} style={styles.streakCopy}>
            Tap ⚙ to set your nickname and photo.
          </KamiText>
        </View>

        {/* ── Sections ── */}
        <Section title="How are you feeling?" marker="✦">
          <MoodSelector />
        </Section>

        <Section title="Today's Reflection" marker="✎">
          <TouchableOpacity style={styles.reflectionCard} activeOpacity={0.85}>
            <KamiText variant="body" color={Colors.textMuted} style={styles.italic}>
              "{DAILY_PROMPT}"
            </KamiText>
            <KamiText variant="caption" color={Colors.primary} style={styles.tapHint}>
              Tap to write ›
            </KamiText>
          </TouchableOpacity>
        </Section>

        <Section
          title="Recent Memories"
          marker="□"
          actionLabel="View all"
          onAction={() => navigation.navigate('Memories')}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memoryScroller}>
            <View style={styles.memoryRow}>
              {SAMPLE_MEMORIES.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} size="sm" />
              ))}
            </View>
          </ScrollView>
        </Section>

        <Section
          title="Write a Letter"
          marker="→"
          onAction={() => navigation.navigate('Future')}
          actionLabel="Open"
        >
          <TouchableOpacity
            style={styles.futureCard}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('Future')}
          >
            <KamiText variant="title" color={Colors.cardBg}>
              Write something for later
            </KamiText>
            <KamiText variant="caption" color="rgba(255,255,255,0.78)" style={styles.futureCopy}>
              Letters and partner features coming soon.
            </KamiText>
          </TouchableOpacity>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Section helper ───────────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  marker: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, marker, actionLabel, onAction, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <KamiText variant="subtitle">{marker} {title}</KamiText>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <KamiText variant="caption" color={Colors.primary} bold>{actionLabel}</KamiText>
        </TouchableOpacity>
      ) : null}
    </View>
    {children}
  </View>
);

export default HomeScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Space[5],
    paddingTop: Space[6],
    paddingBottom: Space[12],
    gap: Space[6],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Space[3],
  },
  identityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space[3],
  },
  avatar: {
    width: Sizing.avatarMd,
    height: Sizing.avatarMd,
    borderRadius: Sizing.avatarMd / 2,
    backgroundColor: Colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { color: Colors.primary, fontSize: FontSize.lg, fontWeight: '800' },
  headerText: { flex: 1 },
  title: { marginTop: Space[1] },
  settingsButton: {
    width: Sizing.avatarSm,
    height: Sizing.avatarSm,
    borderRadius: Sizing.avatarSm / 2,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  settingsIcon: { color: Colors.textSecondary, fontSize: FontSize.md },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Space[3] },
  streakCopy: { flex: 1 },
  section: { gap: Space[3] },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reflectionCard: {
    backgroundColor: Colors.creamDeep,
    borderRadius: Radii.card,
    padding: Space[5],
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  italic: { fontStyle: 'italic' },
  tapHint: { marginTop: Space[2] },
  memoryScroller: { marginHorizontal: -Space[5] },
  memoryRow: { flexDirection: 'row', gap: Space[3], paddingHorizontal: Space[5] },
  futureCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.card,
    padding: Space[6],
    ...Shadows.md,
  },
  futureCopy: { marginTop: Space[1] },
});
