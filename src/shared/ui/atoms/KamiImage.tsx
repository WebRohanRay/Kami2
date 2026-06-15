import React, { useState, useEffect } from 'react';
import { Image, View, Text, type ImageProps, type ImageSourcePropType } from 'react-native';
import { Colors } from '@shared/constants';
import { useTheme } from '@shared/hooks';

export interface KamiImageProps extends Omit<ImageProps, 'source' | 'src'> {
  src: string | null | undefined;
  thumbnailSrc?: string | null | undefined;
  fallbackSrc?: ImageSourcePropType;
}

export const KamiImage: React.FC<KamiImageProps> = ({
  src,
  thumbnailSrc,
  fallbackSrc,
  onError,
  style,
  ...props
}) => {
  const { colors } = useTheme();
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [triedThumbnail, setTriedThumbnail] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setTriedThumbnail(false);
    setUseFallback(false);

    if (thumbnailSrc) {
      setCurrentUri(thumbnailSrc);
    } else if (src) {
      setCurrentUri(src);
    } else {
      setUseFallback(true);
    }
  }, [src, thumbnailSrc]);

  const handleLoadError = () => {
    if (thumbnailSrc && currentUri === thumbnailSrc && !triedThumbnail) {
      setTriedThumbnail(true);
      if (src) {
        setCurrentUri(src);
      } else {
        setUseFallback(true);
      }
    } else {
      setUseFallback(true);
    }
  };

  if (useFallback) {
    if (fallbackSrc) {
      return <Image {...props} style={style} source={fallbackSrc} />;
    }
    return (
      <View style={[style, { backgroundColor: colors.creamDeep, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 20 }}>📷</Text>
      </View>
    );
  }

  return (
    <Image
      {...props}
      style={style}
      source={{ uri: currentUri! }}
      onError={handleLoadError}
    />
  );
};
