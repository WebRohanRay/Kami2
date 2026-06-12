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
import { Colors, Radii, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';

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
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[selectorStyles.root, { backgroundColor: colors.pageBg }]}>
        <View style={selectorStyles.header}>
          <KamiText variant="title">{title}</KamiText>
          <TouchableOpacity onPress={onClose} style={selectorStyles.closeBtn}>
            <KamiText variant="label" color={colors.primary} bold>Cancel</KamiText>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={selectorStyles.scroll}>
          <View style={selectorStyles.list}>
            {options.map((opt) => {
              const active = opt.id === selectedValue;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[selectorStyles.item, active && { backgroundColor: colors.primary + '0a' }]}
                  onPress={() => {
                    onSelect(opt.id);
                    onClose();
                  }}
                >
                  <Text style={selectorStyles.emoji}>{opt.emoji}</Text>
                  <KamiText
                    variant="body"
                    style={{ flex: 1 }}
                    bold={active}
                    color={active ? colors.primary : Colors.textPrimary}
                  >
                    {opt.label}
                  </KamiText>
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

const selectorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space[5],
    paddingVertical: Space[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '44',
  },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5] },
  list: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border + '44',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space[4],
    paddingHorizontal: Space[5],
    gap: Space[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '11',
  },
  emoji: { fontSize: 18 },
});
