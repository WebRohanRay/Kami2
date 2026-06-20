import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Radii, Shadows, Space } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';

export const PartnerSpaceToast: React.FC = () => {
  const { colors } = useTheme();
  const toast = usePartnerSpaceStore((s) => s.toast);
  const setToast = usePartnerSpaceStore((s) => s.setToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [setToast, toast]);

  if (!toast) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={[styles.wrap, { backgroundColor: colors.cardBg, borderColor: colors.border, ...Shadows.md }]}
    >
      <Text style={styles.icon}>{toast.icon}</Text>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {toast.title}
        </Text>
        <Text style={[styles.message, { color: colors.textMuted }]} numberOfLines={2}>
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Space[12],
    left: Space[4],
    right: Space[4],
    zIndex: 500,
    borderWidth: 1,
    borderRadius: Radii.lg,
    padding: Space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
  },
  icon: { fontSize: 24 },
  copy: { flex: 1 },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  message: { fontSize: FontSize.xs, marginTop: 2, lineHeight: 16 },
});
