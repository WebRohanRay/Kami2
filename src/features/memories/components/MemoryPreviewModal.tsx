import React, { useState, useEffect } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { FontSize, Radii, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { ImageZoomModal } from '@shared/ui';
import type { Memory } from '@features/home/types';
import type { CoupleMemory } from '@features/couple/types';

interface MemoryPreviewModalProps {
  visible: boolean;
  memory: Memory | CoupleMemory | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  activeSpace?: 'personal' | 'couple';
  user?: { id: string; timezone?: string } | null;
}

export const MemoryPreviewModal: React.FC<MemoryPreviewModalProps> = ({
  visible,
  memory,
  onClose,
  onEdit,
  onDelete,
  activeSpace,
  user,
}) => {
  const { colors } = useTheme();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      setActiveImageIndex(0);
      setLightboxVisible(false);
      setLightboxIndex(0);
    }
  }, [visible]);

  if (!memory) return null;

  const desc = 'description' in memory ? memory.description : memory.body;
  const mood = 'mood' in memory ? memory.mood : null;
  const location = 'location' in memory ? memory.location : null;
  const time = 'memoryTime' in memory ? memory.memoryTime : null;
  const lastEdited = 'lastEditedNickname' in memory ? memory.lastEditedNickname : null;
  const emoji = 'emoji' in memory ? memory.emoji : '📸';

  const canEdit = !activeSpace || activeSpace === 'personal' || ('userId' in memory ? memory.userId === user?.id : true);
  const { width: screenWidth } = Dimensions.get('window');
  const carouselWidth = screenWidth - 40; // 20 padding on each side

  const handleOptionsPress = () => {
    const options: any[] = [
      { text: 'Cancel', style: 'cancel' },
    ];
    if (canEdit) {
      options.unshift({
        text: 'Edit Memory',
        onPress: () => { onClose(); onEdit(); }
      });
    }
    options.unshift({
      text: 'Delete Memory',
      style: 'destructive' as const,
      onPress: () => { onClose(); onDelete(); }
    });
    Alert.alert('Options', undefined, options);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[pv.root, { backgroundColor: colors.pageBg }]}>
        <View style={[pv.header, { borderBottomColor: colors.divider }]}>
          <KamiText variant="title">Preview Memory</KamiText>
          <View style={{ flexDirection: 'row', gap: Space[2], alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleOptionsPress}
              style={[pv.menuBtn, { backgroundColor: colors.primary + '18' }]}
              accessibilityRole="button"
              accessibilityLabel="Options"
            >
              <Text style={{ fontSize: 18, color: colors.primary, fontWeight: 'bold' }}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={pv.closeBtn} accessibilityRole="button" accessibilityLabel="Close Preview">
              <KamiText variant="label" color={colors.textMuted} bold style={{ fontSize: 13 }}>Close</KamiText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={pv.scroll} showsVerticalScrollIndicator={false}>
          {/* Header metadata (Mood, Date, Time, Location) */}
          <View style={pv.metaRow}>
            {mood ? (
              <View style={[pv.moodBadge, { backgroundColor: colors.primary + '11' }]}>
                <KamiText variant="caption" color={colors.primary} bold>Mood: {mood}</KamiText>
              </View>
            ) : <View />}
            <KamiText variant="caption" color={colors.textMuted}>
              {new Date(memory.memoryDate).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: user?.timezone ?? 'UTC',
              })}
              {time ? ` · ${time}` : ''}
            </KamiText>
          </View>

          {/* Location details */}
          {location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -Space[2], marginBottom: Space[2] }}>
              <Text style={{ fontSize: 12 }}>📍</Text>
              <KamiText variant="caption" color={colors.textSecondary} bold>{location}</KamiText>
            </View>
          )}

          {/* Title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space[2], marginVertical: Space[1] }}>
            <Text style={{ fontSize: 32 }}>{emoji}</Text>
            <KamiText variant="subtitle" bold style={[pv.title, { flex: 1, color: colors.textPrimary }]}>
              {memory.title}
            </KamiText>
          </View>

          {/* Authorship / last edited info */}
          {lastEdited && (
            <View style={pv.authorRow}>
              <KamiText variant="caption" color={colors.primary} bold>
                ✏️ Last edited by {lastEdited}
              </KamiText>
            </View>
          )}

          {/* Premium Image Scroller / Carousel */}
          {memory.imageUrls && memory.imageUrls.length > 0 && (
            <View style={pv.imageScrollerContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={pv.imageScrollView}
                testID="memory-image-carousel"
                accessibilityLabel="Memory Image Carousel"
                onScroll={(e) => {
                  const slide = Math.round(e.nativeEvent.contentOffset.x / carouselWidth);
                  if (slide !== activeImageIndex) {
                    setActiveImageIndex(slide);
                  }
                }}
                scrollEventThrottle={16}
              >
                {memory.imageUrls.map((url: string, index: number) => {
                  const rotateDeg = index % 2 === 0 ? '-1.5deg' : '1.5deg';
                  const thumbUrl = url.includes('.jpg') ? url.replace('.jpg', '_thumb.jpg') : url;
                  return (
                    <View key={index} style={{ width: carouselWidth, height: 320, justifyContent: 'center', alignItems: 'center' }}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                          setLightboxIndex(index);
                          setLightboxVisible(true);
                        }}
                        style={[
                          pv.polaroidCard,
                          {
                            backgroundColor: colors.cardBg,
                            borderColor: colors.border,
                            shadowColor: colors.shadowTint,
                            transform: [{ rotate: rotateDeg }, { scale: 0.98 }]
                          }
                        ]}
                      >
                        <KamiImage
                          src={url}
                          thumbnailSrc={thumbUrl}
                          bucket={'coupleId' in memory ? 'couple_memory_images' : 'memory_images'}
                          style={{ width: carouselWidth - 36, height: 220, borderRadius: 4 }}
                          resizeMode="cover"
                          testID={`memory-image-${index}`}
                        />
                        <KamiText variant="caption" align="center" style={pv.polaroidCaption}>
                          ✨ Snap {index + 1} of {memory.imageUrls.length}
                        </KamiText>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
              {/* Pagination Dots indicator */}
              {memory.imageUrls.length > 1 && (
                <View style={pv.dotIndicatorRow}>
                  {memory.imageUrls.map((_: string, index: number) => (
                    <View
                      key={index}
                      style={[
                        pv.dot,
                        { backgroundColor: index === activeImageIndex ? colors.primary : colors.primary + '33' },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Description Body */}
          {desc ? (
            <View style={pv.bodyContainer}>
              <KamiText variant="body" color={colors.textSecondary} style={pv.bodyText}>
                {desc}
              </KamiText>
            </View>
          ) : null}

          {/* Tags */}
          {'tags' in memory && memory.tags && memory.tags.length > 0 && (
            <View style={pv.tagRow}>
              {memory.tags.map((t: string) => (
                <View key={t} style={[pv.tagChip, { backgroundColor: colors.primary + '15' }]}>
                  <KamiText variant="caption" color={colors.primary}>#{t}</KamiText>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <ImageZoomModal
          visible={lightboxVisible}
          imageUris={memory.imageUrls}
          bucket={'coupleId' in memory ? 'couple_memory_images' : 'memory_images'}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxVisible(false)}
        />
      </SafeAreaView>
    </Modal>
  );
};

const pv = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space[5],
    paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2],
    paddingBottom: Space[4],
    borderBottomWidth: 1,
  },
  menuBtn: { paddingVertical: Space[1] + 2, paddingHorizontal: Space[3], borderRadius: Radii.md },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5], gap: Space[4] },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space[1] },
  moodBadge: { paddingVertical: 2, paddingHorizontal: Space[2], borderRadius: Radii.sm },
  title: { fontSize: FontSize.lg, lineHeight: 28 },
  authorRow: { marginTop: -Space[2], marginBottom: Space[2] },
  imageScrollerContainer: { marginVertical: Space[3], width: '100%' },
  imageScrollView: { width: '100%', height: 320 },
  dotIndicatorRow: { flexDirection: 'row', justifyContent: 'center', gap: Space[1] + 2, marginTop: Space[2] },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bodyContainer: { paddingVertical: Space[2] },
  bodyText: { fontSize: FontSize.base, lineHeight: 26 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2], marginTop: Space[2] },
  tagChip: { paddingVertical: 4, paddingHorizontal: Space[3], borderRadius: Radii.full },
  polaroidCard: {
    padding: 12,
    paddingBottom: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  polaroidCaption: {
    marginTop: 8,
    fontFamily: 'Lora-Regular',
    fontSize: 12,
    opacity: 0.75,
  },
});
