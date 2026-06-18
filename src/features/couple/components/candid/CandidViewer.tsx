import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import { useCoupleStore } from '../../store/coupleStore';
import { FontFamily, FontSize, FontWeight, Radii, Space, Shadows } from '@shared/constants';
import { markCandidAsSeen, reactToCandid } from '../../services/candidService';
import type { CoupleCandid } from '../../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REACTION_EMOJIS = ['❤️', '😍', '🔥', '😂', '🥺', '😘'];

interface CandidViewerProps {
  visible: boolean;
  onClose: () => void;
  onOpenWall: () => void;
  userId: string;
  coupleId: string;
  initialCandidId?: string | null;
}

const CandidViewer: React.FC<CandidViewerProps> = ({
  visible,
  onClose,
  onOpenWall,
  userId,
  coupleId,
  initialCandidId = null,
}) => {
  const { colors } = useTheme();
  const candids = useCoupleStore(s => s.candids);
  const markSeen = useCoupleStore(s => s.markCandidSeen);
  const updateCandid = useCoupleStore(s => s.updateCandidInList);
  const [viewingCandids, setViewingCandids] = useState<CoupleCandid[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allCaughtUp, setAllCaughtUp] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const lastTap = useRef<number | null>(null);

  const [floatingEmojis, setFloatingEmojis] = useState<{
    id: number;
    emoji: string;
    x: number;
    driftX: number;
    anim: Animated.Value;
    scale: number;
    rotation: number;
    duration: number;
  }[]>([]);

  const triggerEmojiBurst = useCallback((emoji: string) => {
    const count = 8;
    const spread = 150;
    const newInstances = Array.from({ length: count }, () => {
      const id = Math.random();
      const instance = {
        id,
        emoji,
        x: (Math.random() - 0.5) * spread,
        driftX: (Math.random() - 0.5) * 80,
        anim: new Animated.Value(0),
        scale: 0.6 + Math.random() * 0.7,
        rotation: (Math.random() - 0.5) * 45,
        duration: 1000 + Math.random() * 600,
      };

      Animated.timing(instance.anim, {
        toValue: 1,
        duration: instance.duration,
        useNativeDriver: true,
      }).start(() => {
        setFloatingEmojis(prev => prev.filter(item => item.id !== id));
      });

      return instance;
    });

    setFloatingEmojis(prev => [...prev, ...newInstances]);
  }, []);

  // Initialize snapshot of viewing candids when modal becomes visible
  useEffect(() => {
    if (visible) {
      let list: CoupleCandid[] = [];
      let startIndex = 0;

      if (initialCandidId) {
        // Opened from the wall - show both own and partner's candids sorted newest-first
        list = [...candids].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const idx = list.findIndex(c => c.id === initialCandidId);
        if (idx !== -1) {
          startIndex = idx;
        }
      } else {
        // Opened from the Partner button - show ONLY partner candids
        const unseen = candids
          .filter(c => !c.isSeen && c.senderId !== userId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        list = unseen.length > 0
          ? unseen
          : candids.filter(c => c.senderId !== userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        startIndex = 0;
      }

      setViewingCandids(list);
      setCurrentIndex(startIndex);
      setAllCaughtUp(false);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      setViewingCandids([]);
    }
  }, [visible, initialCandidId]);

  const handleMarkSeen = useCallback(async (candid: CoupleCandid) => {
    // Find the candid in the reactive store to verify its current isSeen state
    const storeCandid = candids.find(c => c.id === candid.id);
    const isAlreadySeen = storeCandid ? storeCandid.isSeen : candid.isSeen;

    if (!isAlreadySeen && candid.senderId !== userId) {
      markSeen(candid.id, userId);
      await markCandidAsSeen(candid.id);
    }
  }, [userId, markSeen, candids]);

  const handleReaction = useCallback(async (candidId: string, emoji: string) => {
    const candid = candids.find(c => c.id === candidId);
    if (candid) {
      updateCandid({ ...candid, reactionEmoji: emoji }, userId);
      triggerEmojiBurst(emoji);
      await reactToCandid(candidId, emoji);
    }
  }, [candids, updateCandid, userId, triggerEmojiBurst]);

  const handleClose = useCallback(() => {
    const currentCandid = viewingCandids[currentIndex];
    if (currentCandid) {
      handleMarkSeen(currentCandid);
    }
    onClose();
  }, [currentIndex, viewingCandids, handleMarkSeen, onClose]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next < viewingCandids.length) {
      setCurrentIndex(next);
      // Animate transition
      scaleAnim.setValue(0.92);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }).start();
    } else {
      const unseenCount = viewingCandids.filter(c => !c.isSeen && c.senderId !== userId).length;
      if (unseenCount > 0) {
        setAllCaughtUp(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        handleClose();
      }
    }
  }, [currentIndex, viewingCandids, userId, handleClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      scaleAnim.setValue(0.92);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [currentIndex]);

  const handleImagePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    const currentCandid = viewingCandids[currentIndex];
    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      if (currentCandid) {
        handleReaction(currentCandid.id, '❤️');
      }
    } else {
      lastTap.current = now;
    }
  };

  const currentCandid = viewingCandids[currentIndex];

  // Mark as seen when viewing
  useEffect(() => {
    if (visible && currentCandid) {
      handleMarkSeen(currentCandid);
    }
  }, [visible, currentCandid?.id]);

  if (!visible) return null;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        {allCaughtUp ? (
          <View style={styles.caughtUpContainer}>
            <Text style={styles.caughtUpEmoji}>💕</Text>
            <Text style={styles.caughtUpText}>All caught up!</Text>
          </View>
        ) : currentCandid ? (
          <Animated.View
            style={[
              styles.viewerContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Header — sender + timestamp */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.senderName}>
                  {currentCandid.senderNickname || 'Partner'}
                </Text>
                <Text style={styles.timestamp}>
                  {formatTime(currentCandid.createdAt)}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} delayPressIn={0}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Photo Wrapper */}
            <View style={styles.photoWrapper}>
              <TouchableWithoutFeedback onPress={handleImagePress}>
                <View style={[
                  styles.imageContainer,
                  currentCandid.isFirstCandid && styles.goldenFrame,
                ]}>
                  <Image
                    source={{ uri: currentCandid.imagePath }}
                    style={styles.fullImage}
                    resizeMode="contain"
                  />
                  {currentCandid.isFirstCandid && (
                    <View style={styles.firstBadge}>
                      <Text style={styles.firstBadgeText}>✨ Your First Candid</Text>
                    </View>
                  )}
                </View>
              </TouchableWithoutFeedback>

              {/* Navigation arrows */}
              <View style={styles.navOverlay}>
                {currentIndex > 0 ? (
                  <TouchableOpacity
                    style={styles.navLeft}
                    onPress={handlePrev}
                    delayPressIn={0}
                    activeOpacity={0.5}
                  >
                    <View style={[styles.arrowCircle, { marginLeft: Space[2] }]}>
                      <Text style={styles.arrowText}>‹</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.navLeft} />
                )}
                <TouchableOpacity
                  style={styles.navRight}
                  onPress={handleNext}
                  delayPressIn={0}
                  activeOpacity={0.5}
                >
                  <View style={[styles.arrowCircle, { marginRight: Space[2] }]}>
                    <Text style={styles.arrowText}>›</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Caption */}
            {currentCandid.caption && (
              <Text style={styles.captionOverlay}>{currentCandid.caption}</Text>
            )}

            {/* Reactions */}
            <View style={styles.reactionBar}>
              {REACTION_EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.reactionBtn,
                    currentCandid.reactionEmoji === emoji && {
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderColor: 'rgba(255,255,255,0.4)',
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => handleReaction(currentCandid.id, emoji)}
                  delayPressIn={0}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Floating Emojis Burst */}
            <View style={styles.floatingContainer} pointerEvents="none">
              {floatingEmojis.map(emoji => {
                const translateY = emoji.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -200],
                });
                const translateX = emoji.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, emoji.driftX],
                });
                const opacity = emoji.anim.interpolate({
                  inputRange: [0, 0.15, 0.75, 1],
                  outputRange: [0, 1, 0.8, 0],
                });
                const scale = emoji.anim.interpolate({
                  inputRange: [0, 0.25, 1],
                  outputRange: [0.2, emoji.scale, emoji.scale * 0.5],
                });

                return (
                  <Animated.Text
                    key={emoji.id}
                    style={[
                      styles.floatingEmoji,
                      {
                        left: emoji.x,
                        transform: [
                          { translateY },
                          { translateX },
                          { scale },
                          { rotate: `${emoji.rotation}deg` },
                        ],
                        opacity,
                      },
                    ]}
                  >
                    {emoji.emoji}
                  </Animated.Text>
                );
              })}
            </View>

            {/* Progress dots */}
            <View style={styles.dotsContainer}>
              {viewingCandids.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>

            {/* View wall link */}
            <TouchableOpacity onPress={onOpenWall} style={styles.wallLink} delayPressIn={0}>
              <Text style={styles.wallLinkText}>View Wall →</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.caughtUpContainer}>
            <Text style={styles.caughtUpEmoji}>📸</Text>
            <Text style={styles.caughtUpText}>No candids yet</Text>
            <TouchableOpacity onPress={handleClose} style={{ marginTop: Space[4] }} delayPressIn={0}>
              <Text style={styles.wallLinkText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Space[4],
  },
  header: {
    position: 'absolute',
    top: 60,
    left: Space[4],
    right: Space[4],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  senderName: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.body,
  },
  timestamp: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoWrapper: {
    position: 'relative',
    width: SCREEN_WIDTH - Space[8],
    height: SCREEN_HEIGHT * 0.55,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  goldenFrame: {
    borderWidth: 3,
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.lg - 2,
  },
  firstBadge: {
    position: 'absolute',
    top: Space[3],
    left: Space[3],
    backgroundColor: 'rgba(212, 175, 55, 0.9)',
    paddingHorizontal: Space[3],
    paddingVertical: Space[1],
    borderRadius: Radii.full,
  },
  firstBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.body,
  },
  captionOverlay: {
    color: '#fff',
    fontSize: 22,
    fontFamily: FontFamily.handwriting,
    textAlign: 'center',
    marginTop: Space[4],
    paddingHorizontal: Space[8],
    lineHeight: 28,
  },
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space[3],
    marginTop: Space[5],
    zIndex: 10,
    elevation: 10,
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  navOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 5,
    pointerEvents: 'box-none',
  },
  navLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  navRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '300',
    lineHeight: 20,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: Space[5],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  wallLink: {
    marginTop: Space[5],
    paddingVertical: Space[2],
    paddingHorizontal: Space[4],
    zIndex: 10,
    elevation: 10,
  },
  floatingContainer: {
    position: 'absolute',
    bottom: 150,
    left: '50%',
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 999,
  },
  floatingEmoji: {
    position: 'absolute',
    fontSize: 26,
  },
  wallLinkText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontWeight: FontWeight.medium,
  },
  caughtUpContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  caughtUpEmoji: {
    fontSize: 56,
    marginBottom: Space[4],
  },
  caughtUpText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontFamily: FontFamily.handwriting,
    fontWeight: FontWeight.medium,
  },
});

export default React.memo(CandidViewer);
