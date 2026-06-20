import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NOTE_COLORS } from '../types';
import type { NoteColor, NoteFontStyle } from '../types';

interface StickyNoteProps {
  text: string;
  color: NoteColor;
  fontStyle: NoteFontStyle;
  width: number;
  height: number;
}

const FONT_MAP: Record<NoteFontStyle, string> = {
  handwritten: 'Caveat-Regular',
  clean: 'PlusJakartaSans-Regular',
  bold: 'PlusJakartaSans-SemiBold',
};

const StickyNote: React.FC<StickyNoteProps> = ({ text, color, fontStyle, width, height }) => {
  const bgColor = NOTE_COLORS[color] || NOTE_COLORS.yellow;
  const fontFamily = FONT_MAP[fontStyle] || FONT_MAP.handwritten;
  const fontSize = fontStyle === 'handwritten' ? 16 : 13;

  return (
    <View
      style={[
        styles.note,
        {
          width,
          height,
          backgroundColor: bgColor,
        },
      ]}
    >
      {/* Fold corner effect */}
      <View style={[styles.foldCorner, { borderBottomColor: bgColor }]} />

      <Text
        style={[
          styles.text,
          {
            fontFamily,
            fontSize,
            color: color === 'white' ? '#333' : '#2D2D2D',
          },
        ]}
        numberOfLines={6}
      >
        {text}
      </Text>

      {/* Tape strip at top */}
      <View style={styles.tape} />
    </View>
  );
};

export default React.memo(StickyNote);

const styles = StyleSheet.create({
  note: {
    borderRadius: 3,
    padding: 12,
    paddingTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  text: {
    lineHeight: 20,
  },
  foldCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 16,
    borderTopColor: 'rgba(0,0,0,0.06)',
    borderLeftWidth: 16,
    borderLeftColor: 'transparent',
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  tape: {
    position: 'absolute',
    top: -6,
    left: '30%',
    width: '40%',
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    transform: [{ rotate: '-1deg' }],
  },
});
