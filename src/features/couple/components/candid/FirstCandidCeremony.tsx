import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useCoupleStore } from '../../store/coupleStore';
import { KamiImage } from '@shared/ui/atoms/KamiImage';
import { FontFamily, FontSize, Space, Radii } from '@shared/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 25;

// Generate confetti particles with random properties
const generateConfetti = () =>
  Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_WIDTH,
    delay: Math.random() * 800,
    duration: 2000 + Math.random() * 1500,
    size: 6 + Math.random() * 8,
    color: ['#D4AF37', '#FFD700', '#FF69B4', '#87CEEB', '#FF6B6B', '#98FB98', '#DDA0DD'][
      Math.floor(Math.random() * 7)
    ],
    rotation: Math.random() * 360,
  }));

const ConfettiPiece: React.FC<{
  x: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotation: number;
}> = ({ x, delay, duration, size, color, rotation }) => {
  const fallAnim = useRef(new Animated.Value(-50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fallAnim, {
          toValue: SCREEN_HEIGHT + 50,
          duration,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: duration - 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${rotation}deg`, `${rotation + 720}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ translateY: fallAnim }, { rotate }],
        opacity: opacityAnim,
      }}
    />
  );
};

const FirstCandidCeremony: React.FC = () => {
  const showCeremony = useCoupleStore(s => s.showFirstCandidCeremony);
  const imagePath = useCoupleStore(s => s.firstCandidImagePath);
  const dismiss = useCoupleStore(s => s.dismissFirstCandidCeremony);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const confetti = useRef(generateConfetti()).current;

  useEffect(() => {
    if (showCeremony) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showCeremony]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismiss();
    });
  };

  if (!showCeremony) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.touchOverlay}
          activeOpacity={1}
          onPress={handleDismiss}
        >
          {/* Confetti */}
          {confetti.map(p => (
            <ConfettiPiece key={p.id} {...p} />
          ))}

          {/* Golden Polaroid */}
          <Animated.View
            style={[
              styles.goldenPolaroid,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {imagePath && (
              <KamiImage
                src={imagePath}
                bucket="couple_candid_images"
                style={styles.polaroidImage}
                resizeMode="cover"
              />
            )}
            <View style={styles.polaroidCaption}>
              <Text style={styles.captionText}>Your first candid together!</Text>
              <Text style={styles.captionEmoji}>📸💛</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  touchOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldenPolaroid: {
    width: SCREEN_WIDTH * 0.65,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 3,
    borderColor: '#D4AF37',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  polaroidImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  polaroidCaption: {
    alignItems: 'center',
    paddingVertical: Space[4],
  },
  captionText: {
    fontSize: 22,
    fontFamily: FontFamily.handwriting,
    color: '#333',
    textAlign: 'center',
  },
  captionEmoji: {
    fontSize: 28,
    marginTop: Space[2],
  },
});

export default React.memo(FirstCandidCeremony);
