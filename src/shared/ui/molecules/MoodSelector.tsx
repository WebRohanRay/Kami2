import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radii, FontSize, Space } from '@shared/constants';
import { useTextScale, useTheme } from '@shared/hooks';

export interface Mood {
  id:    string;
  emoji: string;
  label: string;
}

const DEFAULT_MOODS: Mood[] = [
  { id: 'joyful',    emoji: '✨', label: 'Joyful'    },
  { id: 'calm',      emoji: '🌸', label: 'Calm'      },
  { id: 'hopeful',   emoji: '🌅', label: 'Hopeful'   },
  { id: 'reflective',emoji: '🌙', label: 'Reflective'},
  { id: 'tired',     emoji: '☁️', label: 'Tired'     },
  { id: 'anxious',   emoji: '🌊', label: 'Anxious'   },
  { id: 'grateful',  emoji: '🌺', label: 'Grateful'  },
];

interface MoodSelectorProps {
  moods?:     Mood[];
  selected?:  string;
  onSelect?:  (id: string) => void;
}

const MoodSelector: React.FC<MoodSelectorProps> = ({
  moods    = DEFAULT_MOODS,
  selected,
  onSelect,
}) => {
  const { scaleSize } = useTextScale();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const pick = (id: string) => {
    onSelect?.(id);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {moods.map(m => {
        const active = selected === m.id;
        return (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, active && styles.chipActive]}
            activeOpacity={0.75}
            onPress={() => pick(m.id)}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.emoji, { fontSize: scaleSize(FontSize.base) }]}>{m.emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive, { fontSize: scaleSize(FontSize.sm) }]}>{m.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

export default MoodSelector;

const getStyles = (colors: any) => StyleSheet.create({
  row: { gap: Space[2], paddingVertical: Space[1] },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space[4],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.creamDeep,
    gap: Space[1],
    flexDirection: 'row',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  emoji: { fontSize: FontSize.base },
  label: {
    fontSize: FontSize.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
