import React from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';

interface FloatingAddButtonProps {
  onPress: () => void;
}

/**
 * Soft pink + button that floats at the bottom-right of the screen.
 * Has a gentle pulse animation to invite interaction.
 */
const FloatingAddButton: React.FC<FloatingAddButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[styles.container, styles.button]}
      accessibilityRole="button"
      accessibilityLabel="Add to partner widget"
    >
      <Text style={styles.plus}>+</Text>
    </TouchableOpacity>
  );
};

export default React.memo(FloatingAddButton);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 50,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF8FAB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  plus: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 32,
    marginTop: -1,
  },
});
