import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { useCoupleStore } from '../../store/coupleStore';
import { useCouple } from '../../hooks/useCouple';
import { FontFamily, FontSize, FontWeight, Radii, Shadows, Space, Opacity } from '@shared/constants';
import { reactToCandid } from '../../services/candidService';
import CandidSendButton from './CandidSendButton';
import CandidViewer from './CandidViewer';
import type { CoupleCandid } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = Space[3];
const ITEM_WIDTH = (SCREEN_WIDTH - Space[4] * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface CandidWallProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  coupleId: string;
}

const CandidWall: React.FC<CandidWallProps> = ({ visible, onClose, userId, coupleId }) => {
  const { colors, isDark } = useTheme();
  const candids = useCoupleStore(s => s.candids);
  const candidStreak = useCoupleStore(s => s.candidStreak);
  const candidsLoading = useCoupleStore(s => s.candidsLoading);
  const updateCandid = useCoupleStore(s => s.updateCandidInList);
  const sendButtonRef = useRef<any>(null);
  const { loadMoreCandids } = useCouple();

  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedCandidId, setSelectedCandidId] = useState<string | null>(null);
  const cellLastTaps = useRef<{ [candidId: string]: number }>({});

  const streakCount = candidStreak?.currentStreak ?? 0;
  const longestStreak = candidStreak?.longestStreak ?? 0;

  const handleReaction = async (candidId: string, emoji: string) => {
    const candid = candids.find(c => c.id === candidId);
    if (candid) {
      updateCandid({ ...candid, reactionEmoji: emoji }, userId);
      Vibration.vibrate(15);
      await reactToCandid(candidId, emoji);
    }
  };

  const renderItem = ({ item, index }: { item: CoupleCandid; index: number }) => {
    const isFirst = item.isFirstCandid;
    const isOwn = item.senderId === userId;

    // Alternating rotations for a realistic pinned-photo collage aesthetic
    const rotations = ['-2deg', '1.5deg', '-1deg', '2deg', '-1.5deg', '0.8deg'];
    const rotation = rotations[index % rotations.length];

    // Tape color variety (aesthetic matte pastel colors)
    const tapeColors = ['#FFD1DC', '#E6E6FA', '#CBF3F0', '#FFDAC1', '#C7CEEA', '#B5EAD7'];
    const tapeColor = tapeColors[index % tapeColors.length];
    const tapeRotations = ['-3deg', '4deg', '-2deg', '3deg', '-4deg', '2deg'];
    const tapeRotation = tapeRotations[index % tapeRotations.length];

    // Masonry staggered vertical offsets (shift middle column down slightly)
    const isMiddleColumn = index % 3 === 1;
    const cellMarginTop = isMiddleColumn ? 14 : 0;

    // Format date in handwriting
    const formattedDate = new Date(item.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const handlePress = () => {
      const now = Date.now();
      const lastTap = cellLastTaps.current[item.id] || 0;
      const DOUBLE_TAP_DELAY = 280;

      if (now - lastTap < DOUBLE_TAP_DELAY) {
        // Double Tap: React with ❤️
        cellLastTaps.current[item.id] = 0;
        handleReaction(item.id, '❤️');
      } else {
        cellLastTaps.current[item.id] = now;
        setTimeout(() => {
          if (cellLastTaps.current[item.id] === now) {
            // Single Tap: Open viewer with haptic vibration feedback
            Vibration.vibrate(8);
            setSelectedCandidId(item.id);
            setViewerVisible(true);
          }
        }, DOUBLE_TAP_DELAY);
      }
    };

    const cardBgColor = isDark ? (colors.cardBg || '#1E1E1E') : '#FFFFFF';
    const borderColor = isFirst ? '#D4AF37' : (isDark ? colors.border : 'rgba(0,0,0,0.05)');

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={[
          styles.polaroidCell,
          {
            backgroundColor: cardBgColor,
            borderColor: borderColor,
            borderWidth: isFirst ? 1.5 : 1,
            transform: [{ rotate: rotation }],
            marginTop: cellMarginTop,
            ...Shadows.md,
          },
        ]}
      >
        {/* Dynamic washi tape sticker */}
        <View style={[styles.washiTape, { backgroundColor: tapeColor + 'D8', transform: [{ rotate: tapeRotation }] }]} />

        <View style={styles.polaroidImageWrapper}>
          <KamiImage
            src={item.thumbPath || item.imagePath}
            bucket="couple_candid_images"
            style={styles.cellImage}
            resizeMode="cover"
          />

          {/* Reaction badge overlapping bottom-right of image */}
          {item.reactionEmoji && (
            <View style={styles.reactionBadge}>
              <Text style={styles.reactionBadgeText}>{item.reactionEmoji}</Text>
            </View>
          )}

          {/* Sender dot overlapping bottom-left of image */}
          <View style={[styles.senderDot, { backgroundColor: isOwn ? colors.primary : colors.accent }]}>
            <Text style={styles.senderInitial}>
              {(item.senderNickname || '?')[0].toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Polaroid white margin below photo */}
        <View style={styles.polaroidTextContainer}>
          <Text style={[styles.polaroidDate, { color: colors.textMuted }]}>
            {formattedDate}
          </Text>
          {item.caption ? (
            <Text style={[styles.polaroidCaption, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.caption}
            </Text>
          ) : (
            <View style={[styles.polaroidCaptionLine, { backgroundColor: colors.border + '44' }]} />
          )}
        </View>

        {/* First candid sparkles */}
        {isFirst && (
          <View style={styles.firstStar}>
            <Text style={styles.firstStarText}>✨</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.wallHeader}>
      <View style={[styles.glassCard, { backgroundColor: colors.cardBg || '#fff', borderColor: colors.border + Opacity.ghost }]}>
        <View style={styles.glassStatCol}>
          <Text style={[styles.glassStatLabel, { color: colors.textMuted }]}>MEMORIES</Text>
          <Text style={[styles.glassStatVal, { color: colors.primary }]}>
            📸 {candids.length}
          </Text>
        </View>
        <View style={[styles.glassDivider, { backgroundColor: colors.border + '33' }]} />
        <View style={styles.glassStatCol}>
          <Text style={[styles.glassStatLabel, { color: colors.textMuted }]}>ACTIVE STREAK</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={[styles.glassStatVal, { color: colors.textPrimary }]}>
              🔥 {streakCount}
            </Text>
            {longestStreak > streakCount && (
              <Text style={[styles.streakBest, { color: colors.textMuted }]}>
                (Best: {longestStreak}d)
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📸</Text>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
        Send your first candid
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary, marginBottom: Space[4] }]}>
        Capture a candid moment and share it with your partner!
      </Text>
      <TouchableOpacity
        style={[styles.emptyCtaButton, { backgroundColor: colors.primary }]}
        onPress={() => sendButtonRef.current?.handlePickImage()}
      >
        <Text style={styles.emptyCtaButtonText}>📸 Take Photo</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    const isLoading = candidsLoading === 'loading';
    if (isLoading && candids.length > 0) {
      return (
        <View style={{ paddingVertical: Space[4], alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return <View style={{ height: Space[8] }} />;
  };

  const wallBgColor = isDark ? colors.pageBg : '#F6F3EB';

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: wallBgColor }]}>
        {/* Header */}
        <View style={[styles.topBar, { borderBottomColor: colors.border + '22' }]}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Our Candid Wall 📸
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} delayPressIn={0}>
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Grid */}
        <FlatList
          data={candids}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreCandids}
          onEndReachedThreshold={0.5}
        />

        {/* Send FAB */}
        <CandidSendButton coupleId={coupleId} ref={sendButtonRef} />

        {/* Fullscreen view trigger when item clicked */}
        <CandidViewer
          visible={viewerVisible}
          onClose={() => {
            setViewerVisible(false);
            setSelectedCandidId(null);
          }}
          onOpenWall={() => setViewerVisible(false)}
          userId={userId}
          coupleId={coupleId}
          initialCandidId={selectedCandidId}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space[4],
    paddingTop: 56,
    paddingBottom: Space[3],
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.display,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  gridContent: {
    padding: Space[4],
    paddingBottom: 120,
  },
  row: {
    gap: GAP,
    marginBottom: Space[2],
  },
  wallHeader: {
    marginBottom: Space[5],
  },
  glassCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: Space[4],
    borderWidth: 1,
    ...Shadows.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  glassStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  glassStatLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  glassStatVal: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FontFamily.display,
  },
  glassDivider: {
    width: 1,
    height: 28,
  },
  streakBest: {
    fontSize: 9,
    fontFamily: FontFamily.body,
    fontWeight: '500',
  },
  polaroidCell: {
    width: ITEM_WIDTH,
    borderRadius: 4,
    padding: 5,
    paddingBottom: 10,
    alignItems: 'center',
    marginBottom: Space[3],
    position: 'relative',
  },
  washiTape: {
    position: 'absolute',
    top: -6,
    width: 32,
    height: 10,
    borderRadius: 1,
    zIndex: 5,
  },
  polaroidImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F0EC',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  reactionBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 6,
  },
  reactionBadgeText: {
    fontSize: 10,
  },
  senderDot: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    zIndex: 6,
  },
  senderInitial: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '800',
  },
  polaroidTextContainer: {
    width: '100%',
    marginTop: 5,
    alignItems: 'center',
  },
  polaroidDate: {
    fontSize: 7.5,
    fontFamily: FontFamily.handwriting,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  polaroidCaption: {
    fontSize: 8.5,
    fontFamily: FontFamily.handwriting,
    marginTop: 1,
    textAlign: 'center',
    width: '90%',
  },
  polaroidCaptionLine: {
    height: 1.5,
    width: '50%',
    borderRadius: 1,
    marginTop: 4,
  },
  firstStar: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 7,
  },
  firstStarText: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: Space[4],
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.display,
    marginBottom: Space[2],
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    paddingHorizontal: Space[8],
  },
  emptyCtaButton: {
    paddingVertical: Space[3],
    paddingHorizontal: Space[6],
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  emptyCtaButtonText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.body,
  },
});

export default React.memo(CandidWall);
