import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { Colors, Radii, Sizing, Space } from '@shared/constants';

interface BottomSheetProps extends ViewProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ children, noPadding, style, ...rest }) => (
  <View style={[styles.sheet, noPadding && styles.zeroPad, style]} {...rest}>
    {/* Drag handle */}
    <View style={styles.handle} />
    {children}
  </View>
);

export default BottomSheet;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: Colors.sheetBg,
    borderTopLeftRadius:  Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1,
    borderColor: 'rgba(217,193,196,0.5)',
    shadowColor: Colors.primaryDark,
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
    backgroundColor: 'rgba(217,193,196,0.65)',
    marginTop: 14,
    marginBottom: 18,
  },
});
