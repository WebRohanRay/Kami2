import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { KamiImage } from '@shared/ui/atoms/KamiImage';

interface PolaroidFrameProps {
  imageUrl: string;
  caption?: string;
  width: number;
  height: number;
}

const PolaroidFrame: React.FC<PolaroidFrameProps> = ({ imageUrl, caption, width, height }) => {
  const frameWidth = width;
  const frameHeight = height + (caption ? 32 : 20);
  const imageWidth = frameWidth - 12;
  const imageHeight = height - 12;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.frame,
        { width: frameWidth, height: frameHeight },
      ]}
    >
      <KamiImage
        src={imageUrl}
        bucket="partner-space"
        style={[styles.photo, { width: imageWidth, height: imageHeight }]}
        resizeMode="cover"
      />
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      )}
    </Animated.View>
  );
};

export default React.memo(PolaroidFrame);

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    alignItems: 'center',
  },
  photo: {
    borderRadius: 2,
  },
  caption: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: 'Caveat-Regular',
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
