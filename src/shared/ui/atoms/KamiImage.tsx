import React, { useState, useEffect } from 'react';
import { Image, View, Text, ActivityIndicator, type ImageProps, type ImageSourcePropType } from 'react-native';
import { Radii } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { resolveImageUri, downloadAndCacheImage } from '@shared/lib/storage/imageResolver';
import { useNetworkStatus } from '@shared/network/NetworkProvider';
import KamiText from './KamiText';

export interface KamiImageProps extends Omit<ImageProps, 'source' | 'src'> {
  src: string | null | undefined;
  bucket?: string; // Supabase bucket name for resolution
  thumbnailSrc?: string | null | undefined;
  fallbackSrc?: ImageSourcePropType;
  showOfflineMessage?: boolean;
}

export const KamiImage: React.FC<KamiImageProps> = ({
  src,
  bucket = 'memory_images',
  thumbnailSrc,
  fallbackSrc,
  onError,
  style,
  showOfflineMessage = true,
  ...props
}) => {
  const { colors } = useTheme();
  const { isConnected } = useNetworkStatus();
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'local' | 'remote' | 'unavailable' | 'resolving'>('resolving');
  const [isUsingThumbnail, setIsUsingThumbnail] = useState(false);

  useEffect(() => {
    let active = true;

    async function resolve() {
      if (!src) {
        if (active) {
          setResolutionStatus('unavailable');
          setCurrentUri(null);
          setIsUsingThumbnail(false);
        }
        return;
      }

      if (active) {
        setResolutionStatus('resolving');
      }

      // Resolve thumbnail if available first, else the original
      const refToResolve = thumbnailSrc || src;
      let result = await resolveImageUri(refToResolve, bucket);
      let usingThumb = !!thumbnailSrc && refToResolve === thumbnailSrc;

      if (usingThumb && result.status === 'unavailable') {
        // Fallback immediately to original if thumbnail resolution failed
        result = await resolveImageUri(src, bucket);
        usingThumb = false;
      }

      if (active) {
        setResolutionStatus(result.status);
        setCurrentUri(result.uri);
        setIsUsingThumbnail(usingThumb);

        // If resolved successfully as remote from Supabase, trigger background caching
        const cacheRef = usingThumb ? thumbnailSrc! : src;
        if (result.status === 'remote' && !cacheRef.startsWith('http') && isConnected) {
          downloadAndCacheImage(cacheRef, bucket).catch(err => {
            console.warn('[KamiImage] Background caching failed:', err);
          });
        }
      }
    }

    resolve();

    return () => {
      active = false;
    };
  }, [src, thumbnailSrc, bucket, isConnected]);

  const handleLoadError = () => {
    if (isUsingThumbnail) {
      // Fallback to main image
      setIsUsingThumbnail(false);
      resolveImageUri(src, bucket).then(result => {
        setResolutionStatus(result.status);
        setCurrentUri(result.uri);
      });
    } else {
      setResolutionStatus('unavailable');
    }
  };

  if (resolutionStatus === 'resolving') {
    return (
      <View style={[style, { backgroundColor: colors.creamDeep, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (resolutionStatus === 'unavailable') {
    if (fallbackSrc) {
      return <Image {...props} style={style} source={fallbackSrc} />;
    }

    if (
      src &&
      (src.startsWith('http') ||
        src.startsWith('file://') ||
        src.startsWith('content://') ||
        src.startsWith('data:') ||
        src.startsWith('ph://') ||
        src.startsWith('asset://') ||
        src.startsWith('assets-library://'))
    ) {
      return (
        <Image
          {...props}
          style={style}
          source={{ uri: src }}
          onError={handleLoadError}
        />
      );
    }

    if (!isConnected && showOfflineMessage) {
      // Case 3: Local missing and no internet
      return (
        <View style={[style, { backgroundColor: colors.creamDeep, justifyContent: 'center', alignItems: 'center', padding: 8, borderWidth: 1, borderColor: colors.border + '33', borderRadius: Radii.card }]}>
          <Text style={{ fontSize: 18, marginBottom: 4 }}>📶</Text>
          <KamiText variant="caption" color={colors.textMuted} align="center" style={{ fontSize: 9, lineHeight: 12 }}>
            Image unavailable. Connect to the internet to restore this image.
          </KamiText>
        </View>
      );
    }

    // Case 4: No source found at all
    return (
      <View style={[style, { backgroundColor: colors.creamDeep, justifyContent: 'center', alignItems: 'center', padding: 8, borderWidth: 1, borderColor: colors.border + '33', borderRadius: Radii.card }]}>
        <Text style={{ fontSize: 18, marginBottom: 4 }}>📷</Text>
        <KamiText variant="caption" color={colors.textMuted} align="center" style={{ fontSize: 9, lineHeight: 12 }}>
          Image could not be found.
        </KamiText>
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
