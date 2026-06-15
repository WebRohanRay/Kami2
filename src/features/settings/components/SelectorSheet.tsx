import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { Radii, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { ThemePalettes } from '@shared/constants/tokens';

export interface SelectOption {
  id: string;
  label: string;
  emoji: string;
}

interface SelectorSheetProps {
  visible: boolean;
  title: string;
  options: readonly SelectOption[];
  selectedValue: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export const SelectorSheet: React.FC<SelectorSheetProps> = ({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <KamiText variant="title">{title}</KamiText>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <KamiText variant="label" color={colors.primary} bold>Cancel</KamiText>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.list}>
            {options.map((opt) => {
              const active = opt.id === selectedValue;
              const palette = ThemePalettes[opt.id];
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.item, active && { backgroundColor: colors.primary + '0a' }]}
                  onPress={() => {
                    onSelect(opt.id);
                    onClose();
                  }}
                >
                  <Text style={styles.emoji}>{opt.emoji}</Text>
                  <KamiText
                    variant="body"
                    style={{ flex: 1 }}
                    bold={active}
                    color={active ? colors.primary : colors.textPrimary}
                  >
                    {opt.label}
                  </KamiText>
                  {palette && (
                    <View style={styles.colorPreview}>
                      <View style={[styles.colorDot, { backgroundColor: palette.primary }]} />
                      <View style={[styles.colorDot, { backgroundColor: palette.accent }]} />
                      <View style={[styles.colorDot, { backgroundColor: palette.pageBg, borderColor: colors.border + '33', borderWidth: 1 }]} />
                    </View>
                  )}
                  {active && <KamiText variant="label" color={colors.primary}>✓</KamiText>}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.pageBg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Space[5],
      paddingVertical: Space[4],
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '44',
    },
    closeBtn: { padding: Space[2] },
    scroll: { padding: Space[5] },
    list: {
      backgroundColor: colors.cardBg,
      borderRadius: Radii.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border + '44',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Space[4],
      paddingHorizontal: Space[5],
      gap: Space[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '11',
    },
    emoji: { fontSize: 18 },
    colorPreview: {
      flexDirection: 'row',
      gap: Space[1],
      marginRight: Space[2],
      alignItems: 'center',
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
  });
