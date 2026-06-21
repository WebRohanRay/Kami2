import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@shared/hooks';
import { Radii, Shadows, Space } from '@shared/constants';
import TicTacToeCell from './TicTacToeCell';
import type { TicTacToeCell as CellValue, TicTacToeState } from '../../types';

interface TicTacToeBoardProps {
  gameState: TicTacToeState;
  displayBoard: CellValue[];  // optimistic or real board
  myId: string;
  onCellPress: (index: number) => void;
  disabled: boolean;
  lastMoveIndex?: number;
}

const TicTacToeBoard: React.FC<TicTacToeBoardProps> = ({
  gameState,
  displayBoard,
  myId,
  onCellPress,
  disabled,
  lastMoveIndex,
}) => {
  const { colors } = useTheme();
  const winLine = gameState.winLine || [];
  const mySymbol = gameState.players.X === myId ? 'X' : 'O';

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, ...Shadows.card }]}>
      <View style={styles.grid}>
        {displayBoard.map((cell, index) => (
          <TicTacToeCell
            key={index}
            value={cell}
            index={index}
            onPress={onCellPress}
            disabled={disabled}
            isWinCell={winLine.includes(index)}
            isMySymbol={cell === mySymbol}
            isLatestMove={index === lastMoveIndex}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.card,
    padding: Space[3],
    marginHorizontal: Space[4],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    aspectRatio: 1,
  },
});

export default React.memo(TicTacToeBoard);
