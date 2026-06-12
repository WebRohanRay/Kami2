import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radii, FontSize, Space } from '@shared/constants';
import { useTextScale } from '@shared/hooks';

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
  const [local, setLocal] = useState<string | undefined>(selected);

  const pick = (id: string) => {
    setLocal(id);
    onSelect?.(id);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {moods.map(m => {
        const active = local === m.id;
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

const styles = StyleSheet.create({
  row: { gap: Space[2], paddingVertical: Space[1] },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space[4],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.creamDeep,
    gap: Space[1],
    flexDirection: 'row',
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  emoji: { fontSize: FontSize.base },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
