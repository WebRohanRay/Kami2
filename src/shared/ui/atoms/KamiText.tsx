import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { FontSize, FontWeight } from '@shared/constants';
import { useTextScale, useTheme } from '@shared/hooks';

type Variant =
  | 'display'    // large screen titles (Lora-Regular/SemiBold)
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
  display:  { fontSize: FontSize.md,    lineHeight: 24, letterSpacing: -0.5 },
  title:    { fontSize: FontSize.base,  lineHeight: 22, letterSpacing: 0.3  },
  subtitle: { fontSize: FontSize.sm,    lineHeight: 18                      },
  body:     { fontSize: FontSize.base,  lineHeight: 26                      },
  caption:  { fontSize: FontSize.xs,    lineHeight: 17                      },
  label:    { fontSize: FontSize.base,  lineHeight: 22                      },
  overline: { fontSize: FontSize.xs,    lineHeight: 17, letterSpacing: 1.5, textTransform: 'uppercase' },
};

const getFontAndWeight = (variant: Variant, bold?: boolean, customFontWeight?: string) => {
  const isSerif = variant === 'display' || variant === 'title';
  
  let weight: '400' | '500' | '600' = '400';
  if (customFontWeight === '500' || customFontWeight === 'medium') {
    weight = '500';
  } else if (bold || customFontWeight === '600' || customFontWeight === 'semibold' || customFontWeight === '700' || customFontWeight === 'bold' || customFontWeight === '800' || customFontWeight === 'extrabold') {
    weight = '600';
  } else {
    // Default weights for variants
    if (variant === 'subtitle' || variant === 'label' || variant === 'overline') {
      weight = '500';
    } else if (variant === 'display' || variant === 'title') {
      weight = '600';
    }
  }

  let fontFamily = 'PlusJakartaSans-Regular';
  if (isSerif) {
    if (weight === '600') fontFamily = 'Lora-SemiBold';
    else if (weight === '500') fontFamily = 'Lora-Medium';
    else fontFamily = 'Lora-Regular';
  } else {
    if (weight === '600') fontFamily = 'PlusJakartaSans-SemiBold';
    else if (weight === '500') fontFamily = 'PlusJakartaSans-Medium';
    else fontFamily = 'PlusJakartaSans-Regular';
  }

  return { fontFamily, fontWeight: weight };
};

const KamiText: React.FC<KamiTextProps> = ({
  variant = 'body',
  color,
  align = 'left',
  bold,
  style,
  children,
  ...rest
}) => {
  const { multiplier } = useTextScale();
  const { colors } = useTheme();
  
  const flatStyle = StyleSheet.flatten(style) || {};
  const customFontWeight = flatStyle.fontWeight ? String(flatStyle.fontWeight) : undefined;
  const styleColor = flatStyle.color;
  
  const fontProps = getFontAndWeight(variant, bold, customFontWeight);

  const baseVariantStyle = variantStyles[variant] as { fontSize: number; lineHeight?: number };
  const customFontSize = flatStyle.fontSize ?? baseVariantStyle.fontSize;
  const customLineHeight = flatStyle.lineHeight ?? baseVariantStyle.lineHeight;

  const scaledFontSize = Math.round(customFontSize * multiplier);
  const scaledLineHeight = customLineHeight ? Math.round(customLineHeight * multiplier) : undefined;

  const resolvedColor = color ?? styleColor ?? (
    variant === 'display' || variant === 'title' || variant === 'label'
      ? colors.textPrimary
      : variant === 'subtitle' || variant === 'body'
      ? colors.textSecondary
      : colors.textMuted
  );

  return (
    <RNText
      style={[
        variantStyles[variant],
        fontProps,
        style,
        { color: resolvedColor, textAlign: align },
        { fontSize: scaledFontSize, lineHeight: scaledLineHeight },
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};

export default KamiText;

