import React from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, Radii, Space } from '@shared/constants';

import type { JournalEntry } from '@features/home/types';
import type { CoupleJournal } from '@features/couple/types';

interface PreviewModalProps {
  visible: boolean;
  entry: JournalEntry | CoupleJournal | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: (e: JournalEntry | CoupleJournal) => void;
  activeSpace?: 'personal' | 'couple';
  user?: { id: string; timezone?: string } | null;
}

function formatDate(iso: string, timezone?: string) {
  const tz = timezone || 'UTC';

  const getTzDateString = (date: Date) => {
    try {
      return date.toLocaleDateString('en-US', { timeZone: tz });
    } catch {
      return date.toDateString();
    }
  };

  const dStr = getTzDateString(new Date(iso));
  const todayStr = getTzDateString(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getTzDateString(yesterday);

  if (dStr === todayStr) return 'Today';
  if (dStr === yesterdayStr) return 'Yesterday';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  visible,
  entry,
  onClose,
  onEdit,
  onDelete,
  activeSpace,
  user,
}) => {
  const { colors } = useTheme();

  if (!entry) return null;

  const canEdit = !activeSpace || activeSpace === 'personal' || entry.userId === user?.id;
  const { width: screenWidth } = Dimensions.get('window');
  const carouselWidth = screenWidth - 40; // 20 padding on each side

  const handleOptionsPress = () => {
    const options: any[] = [
      { text: 'Cancel', style: 'cancel' },
    ];
    if (canEdit) {
      options.unshift({
        text: 'Edit Entry',
        onPress: () => {
          onClose();
          onEdit();
        },
      });
    }
    if (onDelete) {
      options.unshift({
        text: 'Delete Entry',
        style: 'destructive' as const,
        onPress: () => {
          onClose();
          onDelete(entry);
        },
      });
    }
    Alert.alert('Options', undefined, options);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[pv.root, { backgroundColor: colors.pageBg }]}>
        <View style={pv.header}>
          <KamiText variant="title">Preview Entry</KamiText>
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
              <KamiText variant="label" color={Colors.textMuted} bold style={{ fontSize: 13 }}>Close</KamiText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={pv.scroll} showsVerticalScrollIndicator={false}>
          {/* Mood & Date header */}
          <View style={pv.metaRow}>
            {entry.moodId ? (
              <View style={[pv.moodBadge, { backgroundColor: colors.primary + '11' }]}>
                <KamiText variant="caption" color={colors.primary} bold>{entry.moodId}</KamiText>
              </View>
            ) : <View />}
            <KamiText variant="caption" color={Colors.textMuted}>
              {formatDate(entry.entryDate || entry.createdAt, user?.timezone)}
            </KamiText>
          </View>

          {/* Title */}
          <KamiText variant="subtitle" bold style={pv.title}>
            {entry.title || 'Untitled Entry'}
          </KamiText>

          {/* Couple Space authorship info */}
          {activeSpace === 'couple' && (() => {
            const coupleEntry = entry as CoupleJournal;
            return (
              <View style={pv.authorRow}>
                <KamiText variant="caption" color={colors.primary} bold>
                  By {coupleEntry.userNickname || 'Partner'}
                </KamiText>
              </View>
            );
          })()}

          {/* Premium Image Scroller / Carousel */}
          {entry.imageUrls && entry.imageUrls.length > 0 && (
            <View style={pv.imageScrollerContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={pv.imageScrollView}
                testID="journal-image-carousel"
                accessibilityLabel="Journal Image Carousel"
              >
                {entry.imageUrls.map((url: string, index: number) => (
                  <View key={index} style={{ width: carouselWidth, height: 240, overflow: 'hidden' }}>
                    <Image
                      source={{ uri: url }}
                      style={pv.scrollerImage}
                      resizeMode="contain"
                      testID={`journal-image-${index}`}
                    />
                  </View>
                ))}
              </ScrollView>
              {/* Pagination Dots indicator */}
              {entry.imageUrls.length > 1 && (
                <View style={pv.dotIndicatorRow}>
                  {entry.imageUrls.map((_, index: number) => (
                    <View key={index} style={[pv.dot, { backgroundColor: colors.primary + '44' }]} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Body */}
          <View style={pv.bodyContainer}>
            <KamiText variant="body" style={pv.bodyText}>
              {entry.body}
            </KamiText>
          </View>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <View style={pv.tagRow}>
              {entry.tags.map((t: string) => (
                <View key={t} style={[pv.tagChip, { backgroundColor: colors.primary + '15' }]}>
                  <KamiText variant="caption" color={colors.primary}>#{t}</KamiText>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const pv = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  menuBtn: { paddingVertical: Space[1] + 2, paddingHorizontal: Space[3], borderRadius: Radii.md },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5], gap: Space[4] },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space[1] },
  moodBadge: { paddingVertical: 2, paddingHorizontal: Space[2], borderRadius: Radii.sm },
  title: { fontSize: FontSize.lg, lineHeight: 28, color: Colors.textPrimary },
  authorRow: { marginTop: -Space[2], marginBottom: Space[2] },
  imageScrollerContainer: { marginVertical: Space[3], width: '100%', borderRadius: Radii.card, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.03)' },
  imageScrollView: { width: '100%', height: 250 },
  scrollerImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  dotIndicatorRow: { flexDirection: 'row', justifyContent: 'center', gap: Space[1] + 2, marginTop: Space[2] },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bodyContainer: { paddingVertical: Space[2] },
  bodyText: { fontSize: 16, lineHeight: 29, color: 'rgba(28, 25, 23, 0.85)' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[2], marginTop: Space[2] },
  tagChip: { paddingVertical: 4, paddingHorizontal: Space[3], borderRadius: Radii.full },
});
