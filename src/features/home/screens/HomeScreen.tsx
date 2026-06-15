import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@shared/hooks';
import { Radii, Space } from '@shared/constants';
import type { MainTabScreenProps } from '@core/navigation/types';
import KamiText from '@shared/ui/atoms/KamiText';

import { useHomeDashboard, greetingTime, initial } from '../hooks/useHomeDashboard';
import { HomeHeader } from '../components/HomeHeader';
import { PersonalDashboard } from '../components/PersonalDashboard';
import { CoupleDashboard } from '../components/CoupleDashboard';
import { MoodModal } from '../components/MoodModal';
import { CustomMoodModal } from '../components/CustomMoodModal';

type Props = MainTabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const dashboard = useHomeDashboard(navigation);

  if (dashboard.user?.activeSpace === 'couple') {
    if (!dashboard.couple) {
      return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg, alignItems: 'center', justifyContent: 'center' }]}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={{ alignItems: 'center', padding: Space[6], gap: Space[4] }}>
            <Text style={{ fontSize: 48 }}>🌸</Text>
            <KamiText variant="subtitle" bold color={colors.primaryDark} align="center">
              Opening your shared space... 💖
            </KamiText>
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: Space[2] }} />
            <TouchableOpacity
              style={{
                marginTop: Space[4],
                paddingVertical: Space[2],
                paddingHorizontal: Space[4],
                borderRadius: Radii.button,
                borderWidth: 1,
                borderColor: colors.primary + '33',
                backgroundColor: colors.primary + '08',
              }}
              onPress={() => navigation.navigate('Settings')}
            >
              <KamiText variant="caption" color={colors.primary} bold>
                Go to Settings
              </KamiText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── 1. DASHBOARD HEADER ────────────────────── */}
      <HomeHeader
        user={dashboard.user}
        partner={dashboard.partner}
        partnerName={dashboard.partnerName}
        isPartnerOnline={dashboard.isPartnerOnline}
        name={dashboard.name}
        navigation={navigation}
        homeAlerts={dashboard.homeAlerts}
        removeHomeAlert={dashboard.removeHomeAlert}
        streak={dashboard.streak}
        greetingTime={greetingTime}
        initial={initial}
      />

      {/* ── 2. SCROLLABLE DASHBOARD VIEW ───────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.refreshing}
            onRefresh={dashboard.handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {dashboard.user?.activeSpace === 'couple' ? (
          <CoupleDashboard
            user={dashboard.user}
            couple={dashboard.couple}
            partner={dashboard.partner}
            partnerName={dashboard.partnerName}
            isPartnerOnline={dashboard.isPartnerOnline}
            durationObj={dashboard.durationObj}
            durationText={dashboard.durationText}
            nextEventText={dashboard.nextEventText}
            partnerAction={dashboard.partnerAction}
            getPresenceDescription={dashboard.getPresenceDescription}
            resolvedHeroBg={dashboard.resolvedHeroBg}
            unreadLettersCount={dashboard.unreadLettersCount}
            heroContent={dashboard.heroContent}
            loveSending={dashboard.loveSending}
            handleSendLove={dashboard.handleSendLove}
            setCustomMoodModalVisible={dashboard.setCustomMoodModalVisible}
            updateProfile={dashboard.updateProfile}
            shownTimelineEvents={dashboard.shownTimelineEvents}
            isTimelineScrollable={dashboard.isTimelineScrollable}
            flashbackMemory={dashboard.flashbackMemory}
            flashbackImage={dashboard.flashbackImage}
            flashbackTitle={dashboard.flashbackTitle}
            flashbackDesc={dashboard.flashbackDesc}
            lettersForSlide={dashboard.lettersForSlide}
            carouselWidth={dashboard.carouselWidth}
            setCarouselWidth={dashboard.setCarouselWidth}
            handleLetterScroll={dashboard.handleLetterScroll}
            activeLetterSlide={dashboard.activeLetterSlide}
            goalTitle={dashboard.goalTitle}
            goalTimeRemainingText={dashboard.goalTimeRemainingText}
            goalProgress={dashboard.goalProgress}
            getGoalPlantEmoji={dashboard.getGoalPlantEmoji}
            latestCoupleGoal={dashboard.latestCoupleGoal}
            todayQuestion={dashboard.todayQuestion}
            bothAnswered={dashboard.bothAnswered}
            myAnswer={dashboard.myAnswer}
            partnerAnswer={dashboard.partnerAnswer}
            answerInput={dashboard.answerInput}
            setAnswerInput={dashboard.setAnswerInput}
            submittingAnswerState={dashboard.submittingAnswerState}
            setQuestionAnswering={dashboard.setQuestionAnswering}
            submitAnswer={dashboard.submitAnswer}
            pulseAnim={dashboard.pulseAnim}
            navigation={navigation}
            getTimeAgo={dashboard.getTimeAgo}
            friendlyDaysUntil={dashboard.friendlyDaysUntil}
            initial={initial}
          />
        ) : (
          <PersonalDashboard
            navigation={navigation}
            todayMood={dashboard.todayMood}
            recentMoods={dashboard.recentMoods}
            journalEntries={dashboard.journalEntries}
            activeGoals={dashboard.activeGoals}
            todayPrompt={dashboard.todayPrompt}
            promptResponse={dashboard.promptResponse}
            personalLettersLoading={dashboard.personalLettersLoading}
            personalLettersForSlide={dashboard.personalLettersForSlide}
            activePersonalLetterSlide={dashboard.activePersonalLetterSlide}
            setActivePersonalLetterSlide={dashboard.setActivePersonalLetterSlide}
            personalCarouselWidth={dashboard.personalCarouselWidth}
            setPersonalCarouselWidth={dashboard.setPersonalCarouselWidth}
            handlePersonalLetterScroll={dashboard.handlePersonalLetterScroll}
            handleMoodPick={dashboard.handleMoodPick}
            friendlyDaysUntil={dashboard.friendlyDaysUntil}
            getTimeAgo={dashboard.getTimeAgo}
          />
        )}
      </ScrollView>

      {/* Modals */}
      <MoodModal
        visible={dashboard.moodModal}
        mood={dashboard.pending}
        onClose={() => dashboard.setMoodModal(false)}
        onSave={dashboard.handleMoodSave}
        saving={dashboard.moodSaving}
      />

      <CustomMoodModal
        visible={dashboard.customMoodModalVisible}
        onClose={() => dashboard.setCustomMoodModalVisible(false)}
        onSave={dashboard.handleCustomMoodSave}
        saving={dashboard.customMoodSaving}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { paddingHorizontal: Space[5], paddingTop: Space[4], gap: Space[5] },
});

export default HomeScreen;
