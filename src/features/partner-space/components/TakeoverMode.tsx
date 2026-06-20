import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  FadeIn,
  SlideInDown,
  FadeOut,
} from 'react-native-reanimated';
import { useTakeover } from '../hooks/useTakeover';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import { TAKEOVER_DURATION_SECONDS } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Takeover Mode overlay — appears during the 30-second Widget Takeover.
 * Shows a countdown ring, pulsing background, and a "Done" button.
 */
const TakeoverMode: React.FC = () => {
  const { isActive, secondsLeft, endTakeover } = useTakeover();
  const space = usePartnerSpaceStore((s) => s.space);
  const myUserId = usePartnerSpaceStore((s) => s.myUserId);
  const bgPulse = useSharedValue(0);

  // Determine if current user is the one taking over
  const isTakeoverByMe = space?.takeoverBy === myUserId;

  useEffect(() => {
    if (isActive) {
      bgPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [isActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.04 + bgPulse.value * 0.06,
  }));

  // Progress calculation
  const progress = secondsLeft / TAKEOVER_DURATION_SECONDS;
  const progressDegrees = 360 * (1 - progress);

  if (!isActive) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
      pointerEvents="box-none"
    >
      {/* Pulsing background glow */}
      <Animated.View style={[styles.pulseBackground, pulseStyle]} />

      {/* Top banner */}
      <Animated.View
        entering={SlideInDown.delay(200).springify().damping(15)}
        style={styles.banner}
      >
        <View style={styles.bannerContent}>
          {/* Countdown circle */}
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownText}>{secondsLeft}</Text>
          </View>

          {/* Label */}
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>
              {isTakeoverByMe
                ? '🎉 Your Surprise Time!'
                : '❤️ Your partner is here...'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {isTakeoverByMe
                ? 'Rearrange everything before time runs out!'
                : 'Someone is decorating your widget right now'}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%` },
            ]}
          />
        </View>

        {/* Done button (only for the person taking over) */}
        {isTakeoverByMe && (
          <TouchableOpacity
            onPress={endTakeover}
            style={styles.doneButton}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done! ✨</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Animated.View>
  );
};

export default React.memo(TakeoverMode);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  pulseBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF6B8A',
  },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30, 15, 30, 0.92)',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  countdownCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#FF8FAB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 138, 0.15)',
  },
  countdownText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF8FAB',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF0F5',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF8FAB',
    borderRadius: 2,
  },
  doneButton: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
    backgroundColor: '#FF6B8A',
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
