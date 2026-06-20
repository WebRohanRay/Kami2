import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import Canvas from '../components/Canvas';
import { WIDGET_SIZES, SPACE_THEMES, getSpaceThemeConfig } from '../types';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';
import type { WidgetSize } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Screen 4 — Widget Preview & Setup
 * Swipeable widget previews at 3 sizes, theme picker, and instructions.
 */
const WidgetPreviewScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const space = usePartnerSpaceStore((s) => s.space);
  const setSpace = usePartnerSpaceStore((s) => s.setSpace);

  const selectedSize = space?.widgetSize || 'medium';
  const sizeConfig = useMemo(() => WIDGET_SIZES[selectedSize], [selectedSize]);
  const themeOptions = useMemo(
    () => SPACE_THEMES.map((theme) => getSpaceThemeConfig(theme.id, colors)),
    [colors]
  );

  const selectTheme = async (themeId: string) => {
    if (!space) return;
    const res = await SpaceService.updateSpace(space.id, { theme: themeId as any });
    if (res.success) {
      setSpace(res.data);
    }
  };

  const selectSize = async (size: WidgetSize) => {
    if (!space) return;
    const res = await SpaceService.updateSpace(space.id, { widgetSize: size });
    if (res.success) {
      setSpace(res.data);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Widget Preview</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Widget nickname */}
        <Text
          style={[styles.nickname, { color: colors.primary }]}
        >
          {space?.nickname || 'Our Wall'}
        </Text>

        {/* Size selector */}
        <View style={styles.sizeSelector}>
          {(Object.keys(WIDGET_SIZES) as WidgetSize[]).map((size) => (
            <View key={size}>
              <TouchableOpacity
                onPress={() => selectSize(size)}
                style={[
                  styles.sizeBtn,
                  selectedSize === size && { backgroundColor: colors.primary },
                  selectedSize !== size && { backgroundColor: colors.cardBg },
                ]}
              >
                <Text
                  style={[
                    styles.sizeBtnText,
                    { color: selectedSize === size ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {WIDGET_SIZES[size].label}
                </Text>
                <Text
                  style={[
                    styles.sizeBtnSub,
                    { color: selectedSize === size ? 'rgba(255,255,255,0.7)' : colors.textMuted },
                  ]}
                >
                  {WIDGET_SIZES[size].maxVisibleItems} item{WIDGET_SIZES[size].maxVisibleItems > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Canvas preview at selected size */}
        <View style={styles.previewContainer}>
          <Canvas
            editable={false}
            canvasWidth={sizeConfig.previewWidth}
            canvasHeight={sizeConfig.previewHeight}
          />
        </View>

        {/* Theme picker */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Theme</Text>
          <View style={styles.themeGrid}>
            {themeOptions.map((theme) => (
              <TouchableOpacity
                key={theme.id}
                onPress={() => selectTheme(theme.id)}
                style={[
                  styles.themeCard,
                  { backgroundColor: theme.background, borderColor: theme.borderColor },
                  space?.theme === theme.id && styles.themeCardSelected,
                ]}
              >
                <Text style={[styles.themeLabel, { color: theme.textColor }]}>
                  {theme.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Instructions */}
        <View style={[styles.instructionCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}>
          <Text style={[styles.instructionTitle, { color: colors.textPrimary }]}>
            📱 Add {WIDGET_SIZES[selectedSize].label} Widget
          </Text>
          <Text style={[styles.instructionStep, { color: colors.textSecondary }]}>
            1. Long press on your home screen
          </Text>
          <Text style={[styles.instructionStep, { color: colors.textSecondary }]}>
            2. Tap "Widgets"
          </Text>
          <Text style={[styles.instructionStep, { color: colors.textSecondary }]}>
            3. Search for "Partner Space"
          </Text>
          <Text style={[styles.instructionStep, { color: colors.textSecondary }]}>
            4. Drag the widget to your home screen
          </Text>
          <Text style={[styles.instructionNote, { color: colors.textMuted }]}>
            Widget requires the native app build ✨
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default WidgetPreviewScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Space[12],
    paddingBottom: Space[3],
    paddingHorizontal: Space[4],
    borderBottomWidth: 1,
  },
  backButton: { padding: Space[2] },
  backText: { fontSize: FontSize.base },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  content: { padding: Space[4] },
  nickname: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.display,
    textAlign: 'center',
    marginBottom: Space[4],
  },
  sizeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space[3],
    marginBottom: Space[5],
  },
  sizeBtn: {
    paddingHorizontal: Space[4],
    paddingVertical: Space[3],
    borderRadius: Radii.lg,
    alignItems: 'center',
    minWidth: 90,
  },
  sizeBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  sizeBtnSub: { fontSize: FontSize.xs, marginTop: 2 },
  previewContainer: { alignItems: 'center', marginBottom: Space[6] },
  section: { marginBottom: Space[5] },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Space[3] },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space[3] },
  themeCard: {
    width: (SCREEN_WIDTH - 64 - 24) / 3,
    aspectRatio: 1,
    borderRadius: Radii.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space[2],
  },
  themeCardSelected: { borderWidth: 3 },
  themeLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, textAlign: 'center' },
  instructionCard: {
    borderRadius: Radii.card,
    padding: Space[4],
    gap: Space[2],
  },
  instructionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Space[2] },
  instructionStep: { fontSize: FontSize.sm, lineHeight: 22 },
  instructionNote: { fontSize: FontSize.xs, fontStyle: 'italic', marginTop: Space[2] },
});
