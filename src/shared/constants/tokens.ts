export const Palette = {
  cream:'#FFF8F8', creamDeep:'#FFF0F2', creamMid:'#FDE8EC',
  rose100:'#FFD6DE', rose300:'#F4A0B5', rose500:'#C96882',
  rose700:'#953F56', rose900:'#2D141B',
  mauve400:'#B591C8', ink:'#2D141B', slate:'#544245',
  mist:'#877275', fog:'#D9C1C4', white:'#FFFFFF',
  success:'#6DB88C', warning:'#E8A84A', error:'#D95555',
} as const;

export const Colors = {
  pageBg:Palette.cream, cardBg:Palette.white, inputBg:Palette.creamDeep,
  creamDeep:Palette.creamDeep, creamMid:Palette.creamMid,
  primary:Palette.rose500, primaryDark:Palette.rose700, primaryLight:Palette.rose300,
  rose100:Palette.rose100, accent:Palette.mauve400,
  textPrimary:Palette.ink, textSecondary:Palette.slate, textMuted:Palette.mist,
  textOnPrimary:Palette.white, border:Palette.fog,
  success:Palette.success, warning:Palette.warning, error:Palette.error,
} as const;

export const FontSize = {
  xs:11, sm:13, base:15, md:17, lg:20, xl:24, '2xl':30, '3xl':38,
} as const;

export const FontWeight = {
  regular:'400' as const, medium:'500' as const,
  semibold:'600' as const, bold:'700' as const, extrabold:'800' as const,
} as const;

export const Space:Record<0|1|2|3|4|5|6|7|8|10|12|14|16|20, number> = {
  0:0,1:4,2:8,3:12,4:16,5:20,6:24,7:28,8:32,10:40,12:48,14:56,16:64,20:80,
};

export const Radii = {
  xs:4, sm:8, md:12, lg:16, xl:20, full:999,
  input:14, button:27, card:20, sheet:32,
} as const;

export const Shadows = {
  sm:{ shadowColor:Palette.rose500, shadowOffset:{width:0,height:2},  shadowOpacity:0.07, shadowRadius:6,  elevation:2 },
  md:{ shadowColor:Palette.rose500, shadowOffset:{width:0,height:4},  shadowOpacity:0.10, shadowRadius:14, elevation:5 },
  card:{ shadowColor:Palette.rose900, shadowOffset:{width:0,height:3},shadowOpacity:0.06, shadowRadius:10, elevation:4 },
} as const;

export const Sizing = {
  inputHeight:54, buttonHeight:54,
  avatarSm:36, avatarMd:52, avatarLg:96,
  tabBarHeight:80,
} as const;

import { Platform } from 'react-native';

export const FontFamily = {
  display: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  body: Platform.OS === 'ios' ? 'System' : 'sans-serif',
} as const;

export const LineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
} as const;