import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useTheme } from '@shared/hooks';
import { Opacity } from '@shared/constants';

/**
 * CandidEmptyOutline — The "patient" empty state.
 * A faint dashed border polaroid outline that sits where the stack would be.
 */
const CandidEmptyOutline: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.outline, { borderColor: colors.border + Opacity.medium }]}>
      <View style={[styles.imageArea, { backgroundColor: colors.creamDeep + '22', justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }]}>
        <Text style={{ fontSize: 18, opacity: 0.7 }}>📸</Text>
      </View>
      <View style={[styles.captionArea, { backgroundColor: colors.creamDeep + '11' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  outline: {
    width: 80,
    height: 100,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 4,
    opacity: 0.7,
    backgroundColor: 'transparent',
  },
  imageArea: {
    flex: 1,
    borderRadius: 3,
  },
  captionArea: {
    height: 14,
    borderRadius: 2,
    marginTop: 3,
  },
});

export default React.memo(CandidEmptyOutline);
