import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { Radii, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';

interface BottomSheetProps extends ViewProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ children, noPadding, style, ...rest }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.divider,
          shadowColor: colors.shadowTint,
        },
        noPadding && styles.zeroPad,
        style
      ]}
      {...rest}
    >
      {/* Drag handle */}
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
      {children}
    </View>
  );
};

export default BottomSheet;

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius:  Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 10,
  },
  zeroPad: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 18,
  },
});
