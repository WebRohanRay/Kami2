import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { REACTION_EMOJIS } from '../types';

interface ReactionBarProps {
  currentReaction?: string | null;
  onReact: (emoji: string) => void;
  onDismiss: () => void;
}

const ReactionBar: React.FC<ReactionBarProps> = ({ currentReaction, onReact, onDismiss }) => {
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(15)}
      style={styles.container}
    >
      <View style={styles.bar}>
        {REACTION_EMOJIS.map((emoji, index) => {
          const isSelected = currentReaction === emoji;
          return (
            <Animated.View
              key={emoji}
              entering={ZoomIn.delay(index * 60).springify().damping(12)}
            >
              <TouchableOpacity
                onPress={() => onReact(emoji)}
                activeOpacity={0.7}
                style={[
                  styles.emojiButton,
                  isSelected && styles.emojiButtonSelected,
                ]}
              >
                <Text style={[styles.emoji, isSelected && styles.emojiSelected]}>
                  {emoji}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <TouchableOpacity onPress={onDismiss} style={styles.dismissArea} />
    </Animated.View>
  );
};

export default React.memo(ReactionBar);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 100,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  emojiButtonSelected: {
    backgroundColor: '#FFE4EC',
    transform: [{ scale: 1.1 }],
  },
  emoji: {
    fontSize: 28,
  },
  emojiSelected: {
    fontSize: 32,
  },
});
