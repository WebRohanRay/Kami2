import React, { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import { useCoupleStore } from '../../store/coupleStore';
import { FontFamily, Radii, Shadows, Space, Opacity } from '@shared/constants';
import CandidEmptyOutline from './CandidEmptyOutline';
import CandidViewer from './CandidViewer';
import CandidWall from './CandidWall';
import CandidSendButton from './CandidSendButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STACK_WIDTH = 80;
const STACK_HEIGHT = 100;

interface CandidStackProps {
  coupleId: string;
  userId: string;
  viewerVisible: boolean;
  setViewerVisible: (visible: boolean) => void;
  wallVisible: boolean;
  setWallVisible: (visible: boolean) => void;
}

export interface CandidStackRef {
  handlePickImage: () => void;
}

const CandidStack = forwardRef<CandidStackRef, CandidStackProps>(({
  coupleId,
  userId,
  viewerVisible,
  setViewerVisible,
  wallVisible,
  setWallVisible,
}, ref) => {
  const { colors } = useTheme();
  const candids = useCoupleStore(s => s.candids);
  const unseenCount = useCoupleStore(s => s.unseenCandidCount);
  const candidStreak = useCoupleStore(s => s.candidStreak);
  const sendButtonRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    handlePickImage: () => {
      sendButtonRef.current?.handlePickImage();
    }
  }));

  // Filter showing only partner-sent unseen candids
  const unseenPartnerCandids = useMemo(() => {
    return candids.filter(c => c.senderId !== userId && !c.isSeen);
  }, [candids, userId]);

  // Breathing pulse animation
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (unseenCount > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.04,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      breatheAnim.setValue(1);
    }
  }, [unseenCount]);

  // Fly-In spring entry animation when a new unseen partner candid is received
  const slideInAnim = useRef(new Animated.Value(0)).current;
  const prevLatestCandidId = useRef<string | null>(null);

  useEffect(() => {
    const latest = unseenPartnerCandids[0];
    if (latest && latest.id !== prevLatestCandidId.current) {
      slideInAnim.setValue(200); // Start offscreen right
      Animated.spring(slideInAnim, {
        toValue: 0,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }).start();
      prevLatestCandidId.current = latest.id;
    } else if (!latest) {
      prevLatestCandidId.current = null;
    }
  }, [unseenPartnerCandids]);

  const translateX = slideInAnim;
  const rotateAnim = slideInAnim.interpolate({
    inputRange: [0, 200],
    outputRange: ['0deg', '15deg'],
  });

  // Get the most recent 3 unseen partner candids for stacking
  const stackCandids = useMemo(() => {
    return unseenPartnerCandids.slice(0, 3);
  }, [unseenPartnerCandids]);

  const hasUnseenPartnerCandids = unseenPartnerCandids.length > 0;
  const streakCount = candidStreak?.currentStreak ?? 0;

  // Last candid time ago text
  const lastCandidTimeText = useMemo(() => {
    if (candids.length === 0) return null;
    const sorted = [...candids].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const mostRecent = sorted[0];
    if (!mostRecent) return null;

    const ms = Date.now() - new Date(mostRecent.createdAt).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (day > 0) return `Last: ${day}d ago`;
    if (hr > 0) return `Last: ${hr}h ago`;
    if (min > 0) return `Last: ${min}m ago`;
    return 'Last: Just now';
  }, [candids]);

  const handlePress = () => {
    if (hasUnseenPartnerCandids) {
      setViewerVisible(true);
    } else {
      // Direct quick send when empty outline is tapped
      sendButtonRef.current?.handlePickImage();
    }
  };

  return (
    <>
      <View style={styles.container} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePress}
          onLongPress={() => setWallVisible(true)}
          delayPressIn={0}
          style={styles.touchArea}
        >
          <Animated.View
            style={[
              styles.stackWrapper,
              {
                transform: [
                  { scale: breatheAnim },
                  { translateX: translateX },
                  { rotate: rotateAnim },
                ],
              },
            ]}
          >
            {hasUnseenPartnerCandids ? (
              <>
                {/* Stacked polaroid cards */}
                {stackCandids.reverse().map((candid, index) => {
                  const rotation = index === 0 ? -3 : index === 1 ? 0 : 3;
                  const isFirst = candid.isFirstCandid;

                  return (
                    <View
                      key={candid.id}
                      style={[
                        styles.polaroid,
                        {
                          backgroundColor: colors.cardBg || '#fff',
                          borderColor: isFirst ? '#D4AF37' : colors.border + Opacity.muted,
                          borderWidth: isFirst ? 2 : 1,
                          transform: [{ rotate: `${rotation}deg` }],
                          zIndex: index,
                          ...Shadows.sm,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: candid.thumbPath ? candid.thumbPath : candid.imagePath }}
                        style={styles.polaroidImage}
                        resizeMode="cover"
                      />
                      <View style={styles.polaroidCaption}>
                        {candid.caption ? (
                          <Text
                            style={[styles.captionText, { color: colors.textMuted }]}
                            numberOfLines={1}
                          >
                            {candid.caption}
                          </Text>
                        ) : (
                          <View style={[styles.captionPlaceholder, { backgroundColor: colors.creamDeep + '33' }]} />
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Unseen count badge */}
                {unseenCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#D4AF37' }]}>
                    <Text style={styles.badgeText}>
                      {unseenCount > 99 ? '💌 99+' : `💌 ${unseenCount}`}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <CandidEmptyOutline />
            )}
          </Animated.View>

          {/* Streak badge below the stack */}
          {streakCount > 0 && (
            <View style={[styles.streakBadge, { backgroundColor: colors.cardBg || '#fff', borderColor: colors.border + Opacity.ghost }]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakText, { color: colors.textPrimary }]}>{streakCount}</Text>
            </View>
          )}

          {/* Last candid time badge */}
          {lastCandidTimeText && (
            <View style={[styles.lastCandidBadge, { backgroundColor: colors.cardBg || '#fff', borderColor: colors.border + Opacity.ghost }]}>
              <Text style={[styles.lastCandidText, { color: colors.textSecondary }]}>{lastCandidTimeText}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Headless/Invisible Send Button (provides caption modal) */}
        <CandidSendButton
          coupleId={coupleId}
          invisible={true}
          ref={sendButtonRef}
        />
      </View>

      {/* Viewer Modal */}
      <CandidViewer
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        onOpenWall={() => {
          setViewerVisible(false);
          setTimeout(() => setWallVisible(true), 300);
        }}
        userId={userId}
        coupleId={coupleId}
      />

      {/* Wall Modal */}
      <CandidWall
        visible={wallVisible}
        onClose={() => setWallVisible(false)}
        userId={userId}
        coupleId={coupleId}
      />
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: -30,
    top: '35%',
    zIndex: 100,
    alignItems: 'center',
  },
  touchArea: {
    alignItems: 'center',
    paddingLeft: 10,
    paddingVertical: 10,
  },
  stackWrapper: {
    width: STACK_WIDTH + 16,
    height: STACK_HEIGHT + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  polaroid: {
    position: 'absolute',
    width: STACK_WIDTH,
    height: STACK_HEIGHT,
    borderRadius: 6,
    padding: 4,
  },
  polaroidImage: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: '#eee',
  },
  polaroidCaption: {
    height: 14,
    marginTop: 3,
    justifyContent: 'center',
  },
  captionText: {
    fontSize: 7,
    fontFamily: FontFamily.handwriting,
  },
  captionPlaceholder: {
    height: 6,
    width: '60%',
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    left: -4,
    minWidth: 32,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    marginTop: 6,
    borderWidth: 1,
    transform: [{ translateX: -15 }],
    ...Shadows.sm,
  },
  streakEmoji: {
    fontSize: 11,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '700',
  },
  lastCandidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Radii.full,
    marginTop: 4,
    borderWidth: 1,
    transform: [{ translateX: -15 }],
    ...Shadows.sm,
  },
  lastCandidText: {
    fontSize: 9,
    fontWeight: '500',
  },
});

export default React.memo(CandidStack);

