import React from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FallingPetal from './FallingPetal';
import { Colors } from '@shared/constants';
import { useTheme } from '@shared/hooks';

const { width: W, height: H } = Dimensions.get('window');
const PETAL_COUNT = 14;

interface HeroSectionProps {
  imageUri?:       string;
  heightRatio?:    number;   // fraction of screen height, default 0.45
  gradientEndColor?: string;
}

const DEFAULT_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAvrEYm3oEmMIhJpUg1WiOE1FV4tpxLbcxCbaNa3DpAmYLHpKHK_AkaB2le51X1GRWsJq20aTdB87VpGv95odJwp0jOS1_6fqH1SmuRASTJIy1UNYEHtMMcmnSQIeP2Cy94LgCdfsV41lbNrr3i7EcFCbk2iWdTMKH7fWXuNHgjKmVpci_oS-zShVqCBVvF-7XCB3VAfeyfT8Hebn9IbcwxJymyuFzMcvL6lEDqJicFKwnbhOqrmTvxLCEHeYXg-awwPSXDUtGZ';

const HeroSection: React.FC<HeroSectionProps> = ({
  imageUri         = DEFAULT_URI,
  heightRatio      = 0.45,
  gradientEndColor,
}) => {
  const { colors } = useTheme();
  const resolvedEndColor = gradientEndColor ?? colors.pageBg;
  const themeColors = { primaryLight: colors.primaryLight, creamMid: colors.creamMid };

  return (
    <View style={[styles.hero, { height: H * heightRatio }]}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', `${resolvedEndColor}55`, resolvedEndColor]}
        style={styles.gradient}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: PETAL_COUNT }).map((_, i) => (
          <FallingPetal key={i} delay={i * 800} themeColors={themeColors} />
        ))}
      </View>
    </View>
  );
};

export default HeroSection;

const styles = StyleSheet.create({
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: W,
    zIndex: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
});
