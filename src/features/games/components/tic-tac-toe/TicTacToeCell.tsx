import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text } from 'react-native';
import { useTheme } from '@shared/hooks';
import { Radii, Space, Shadows } from '@shared/constants';
import type { TicTacToeCell as CellValue } from '../../types';

interface TicTacToeCellProps {
  value: CellValue;
  index: number;
  onPress: (index: number) => void;
  disabled: boolean;
  isWinCell: boolean;
  isMySymbol: boolean;
  isLatestMove: boolean;
}

const TicTacToeCell: React.FC<TicTacToeCellProps> = ({
  value,
  index,
  onPress,
  disabled,
  isWinCell,
  isMySymbol,
  isLatestMove,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const prevValueRef = useRef<CellValue>(null);

  useEffect(() => {
    if (value && !prevValueRef.current) {
      // New symbol placed — animate in
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
    prevValueRef.current = value;
  }, [value]);

  const handlePress = () => {
    if (!disabled && !value) {
      onPress(index);
    }
  };

  const cellBg = isWinCell
    ? colors.primary + '25'
    : 'transparent';

  const symbolColor = value === 'X'
    ? (isMySymbol ? colors.primary : colors.accent)
    : (isMySymbol ? colors.primary : colors.accent);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={handlePress}
      disabled={disabled || !!value}
      style={[
        styles.cell,
        {
          backgroundColor: cellBg,
          borderColor: colors.border + '60',
        },
        // Border styling for grid lines
        index % 3 !== 2 && { borderRightWidth: 2 },
        index < 6 && { borderBottomWidth: 2 },
      ]}
    >
      {value && (
        <Animated.Text
          style={[
            styles.symbol,
            {
              color: symbolColor,
              transform: [{ scale: scaleAnim }],
              opacity: scaleAnim,
            },
          ]}
        >
          {value}
        </Animated.Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
  },
  symbol: {
    fontSize: 42,
    fontWeight: '600',
    letterSpacing: 1,
  },
});

export default React.memo(TicTacToeCell);
