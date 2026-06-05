import React from 'react';
import { Text as RNText, TextProps, StyleSheet, Platform } from 'react-native';
import { Colors, FontFamily, FontSize, FontWeight, LineHeight } from '@shared/constants';

type Variant =
  | 'display'    // large screen titles (Georgia / Playfair)
  | 'title'      // section headings
  | 'subtitle'   // sub-headings
  | 'body'       // default body
  | 'caption'    // small helper text
  | 'label'      // button / form labels
  | 'overline';  // small ALL-CAPS eyebrow text

interface KamiTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

const variantStyles: Record<Variant, object> = {
  display:  { fontSize: FontSize['2xl'], fontFamily: Platform.OS === 'ios' ? FontFamily.display : 'serif', fontWeight: FontWeight.bold,     lineHeight: FontSize['2xl']  * LineHeight.tight  },
  title:    { fontSize: FontSize.xl,    fontFamily: Platform.OS === 'ios' ? FontFamily.display : 'serif', fontWeight: FontWeight.bold,     lineHeight: FontSize.xl     * LineHeight.snug   },
  subtitle: { fontSize: FontSize.md,    fontFamily: FontFamily.body,                                       fontWeight: FontWeight.semibold, lineHeight: FontSize.md     * LineHeight.snug   },
  body:     { fontSize: FontSize.base,  fontFamily: FontFamily.body,                                       fontWeight: FontWeight.regular,  lineHeight: FontSize.base   * LineHeight.normal },
  caption:  { fontSize: FontSize.sm,    fontFamily: FontFamily.body,                                       fontWeight: FontWeight.regular,  lineHeight: FontSize.sm     * LineHeight.normal },
  label:    { fontSize: FontSize.base,  fontFamily: FontFamily.body,                                       fontWeight: FontWeight.semibold, lineHeight: FontSize.base   * LineHeight.snug   },
  overline: { fontSize: FontSize.xs,    fontFamily: FontFamily.body,                                       fontWeight: FontWeight.bold,     letterSpacing: 1.2, textTransform: 'uppercase' },
};

const defaultColors: Record<Variant, string> = {
  display:  Colors.textPrimary,
  title:    Colors.textPrimary,
  subtitle: Colors.textSecondary,
  body:     Colors.textSecondary,
  caption:  Colors.textMuted,
  label:    Colors.textPrimary,
  overline: Colors.textMuted,
};

const KamiText: React.FC<KamiTextProps> = ({
  variant = 'body',
  color,
  align = 'left',
  bold,
  style,
  children,
  ...rest
}) => (
  <RNText
    style={[
      variantStyles[variant],
      { color: color ?? defaultColors[variant], textAlign: align },
      bold ? { fontWeight: FontWeight.bold } : null,
      style,
    ]}
    {...rest}
  >
    {children}
  </RNText>
);

export default KamiText;
