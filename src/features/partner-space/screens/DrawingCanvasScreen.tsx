import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = SCREEN_WIDTH - 32;

const BRUSH_SIZES = [
  { label: 'Thin', size: 2 },
  { label: 'Medium', size: 5 },
  { label: 'Thick', size: 10 },
];

const PRESET_COLORS = [
  '#000000', '#FF0000', '#FF6B8A', '#FF9800', '#FFEB3B',
  '#4CAF50', '#2196F3', '#9C27B0', '#FFFFFF', '#8B4513',
];

/**
 * Screen 3 — Drawing Canvas
 * Full-screen drawing surface.
 * Note: Uses a simplified canvas since react-native-skia requires native build.
 * For production, replace with @shopify/react-native-skia Canvas.
 */
const DrawingCanvasScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const space = usePartnerSpaceStore((s) => s.space);

  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [isEraser, setIsEraser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // In production, this would use Skia canvas ref
  // For now, we provide the UI shell
  const canvasRef = useRef<any>(null);

  const handleSave = useCallback(async () => {
    if (!space) return;
    setIsSaving(true);

    Alert.alert('Drawing coming soon', 'The drawing tool needs a native canvas before it can save real drawings.');
    setIsSaving(false);
  }, [space]);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Top bar */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.topBar, { borderBottomColor: colors.divider }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Draw ✍️</Text>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            onPress={() => setShowPreview(!showPreview)}
            style={styles.previewBtn}
          >
            <Text style={styles.previewBtnText}>{showPreview ? '🎨' : '👁️'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.saveBtnText}>
              {isSaving ? '...' : 'Done ✨'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Drawing canvas area */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.canvasArea}
      >
        <View
          ref={canvasRef}
          style={[styles.drawCanvas, { backgroundColor: '#FFFFFF' }]}
        >
          {/* Skia Canvas goes here in production */}
          <Text style={styles.canvasPlaceholder}>
            🎨{'\n\n'}Drawing Canvas{'\n'}
            <Text style={styles.canvasSubtext}>
              Uses @shopify/react-native-skia{'\n'}in production builds
            </Text>
          </Text>
        </View>
      </Animated.View>

      {/* Toolbar */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={[styles.toolbar, { backgroundColor: colors.cardBg, borderTopColor: colors.divider }]}
      >
        {/* Brush sizes */}
        <View style={styles.toolSection}>
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>Size</Text>
          <View style={styles.toolRow}>
            {BRUSH_SIZES.map((b) => (
              <TouchableOpacity
                key={b.label}
                onPress={() => { setBrushSize(b.size); setIsEraser(false); }}
                style={[
                  styles.brushBtn,
                  brushSize === b.size && !isEraser && { backgroundColor: colors.primary + '20' },
                ]}
              >
                <View
                  style={[
                    styles.brushDot,
                    {
                      width: b.size * 3,
                      height: b.size * 3,
                      backgroundColor: isEraser ? colors.textMuted : brushColor,
                      borderRadius: b.size * 1.5,
                    },
                  ]}
                />
                <Text style={[styles.brushLabel, { color: colors.textSecondary }]}>{b.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setIsEraser(!isEraser)}
              style={[
                styles.brushBtn,
                isEraser && { backgroundColor: colors.primary + '20' },
              ]}
            >
              <Text style={styles.eraserEmoji}>🧹</Text>
              <Text style={[styles.brushLabel, { color: colors.textSecondary }]}>Eraser</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Color picker */}
        <View style={styles.toolSection}>
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>Color</Text>
          <ScrollableColorPicker
            colors={PRESET_COLORS}
            selected={brushColor}
            onSelect={(c) => { setBrushColor(c); setIsEraser(false); }}
          />
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Color Picker Sub-Component ───────────────────────────────────────────────

const ScrollableColorPicker: React.FC<{
  colors: string[];
  selected: string;
  onSelect: (color: string) => void;
}> = ({ colors: colorList, selected, onSelect }) => (
  <View style={styles.colorRow}>
    {colorList.map((c) => (
      <TouchableOpacity
        key={c}
        onPress={() => onSelect(c)}
        style={[
          styles.colorDot,
          { backgroundColor: c },
          c === '#FFFFFF' && styles.colorDotWhite,
          selected === c && styles.colorDotSelected,
        ]}
      />
    ))}
  </View>
);

export default DrawingCanvasScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Space[12],
    paddingBottom: Space[3],
    paddingHorizontal: Space[4],
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Space[2],
  },
  backText: {
    fontSize: FontSize.base,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
  },
  previewBtn: {
    padding: Space[1],
  },
  previewBtnText: {
    fontSize: 22,
  },
  saveBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.button,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space[4],
  },
  drawCanvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  canvasPlaceholder: {
    fontSize: 16,
    textAlign: 'center',
    color: '#999',
  },
  canvasSubtext: {
    fontSize: 12,
    color: '#BBB',
  },
  toolbar: {
    borderTopWidth: 1,
    paddingHorizontal: Space[4],
    paddingTop: Space[3],
    paddingBottom: Space[8],
  },
  toolSection: {
    marginBottom: Space[3],
  },
  toolLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginBottom: Space[2],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  toolRow: {
    flexDirection: 'row',
    gap: Space[3],
  },
  brushBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space[2],
    borderRadius: Radii.md,
    minWidth: 56,
    gap: 4,
  },
  brushDot: {
    // Dynamic size set inline
  },
  brushLabel: {
    fontSize: 10,
  },
  eraserEmoji: {
    fontSize: 18,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space[2],
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotWhite: {
    borderWidth: 1,
    borderColor: '#DDD',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#333',
  },
});
