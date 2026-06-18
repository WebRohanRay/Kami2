import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Vibration,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@shared/hooks';
import { useCoupleStore } from '../../store/coupleStore';
import { sendCandid } from '../../services/candidService';
import { useAuthStore } from '@features/auth';
import { FontFamily, FontSize, FontWeight, Radii, Shadows, Space, Opacity } from '@shared/constants';

interface CandidSendButtonProps {
  coupleId: string;
  small?: boolean;
  invisible?: boolean;
}

export interface CandidSendButtonRef {
  handlePickImage: () => void;
  handleCamera: () => void;
}

const CandidSendButton = forwardRef<CandidSendButtonRef, CandidSendButtonProps>(
  ({ coupleId, small = false, invisible = false }, ref) => {
    const { colors } = useTheme();
    const [captionModalVisible, setCaptionModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [sending, setSending] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useImperativeHandle(ref, () => ({
      handlePickImage,
      handleCamera,
    }));


  const handlePickImage = () => {
    Alert.alert(
      '📸 Send a Candid',
      'Choose how to capture your moment',
      [
        {
          text: '📷 Take Photo',
          onPress: handleCamera,
        },
        {
          text: '🖼️ Choose from Gallery',
          onPress: handleGallery,
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take candid photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setCaption('');
      setCaptionModalVisible(true);
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setCaption('');
      setCaptionModalVisible(true);
    }
  };

  const handleSend = async () => {
    if (!selectedImage) return;
    setSending(true);

    const result = await sendCandid(coupleId, selectedImage, caption || undefined);

    if (result.success && result.candid) {
      const user = useAuthStore.getState().user;
      const store = useCoupleStore.getState();

      // Prepend to store
      store.prependCandid({
        ...result.candid,
        senderNickname: user?.nickname || 'You',
      }, user?.id || '');

      // If first candid, trigger ceremony
      if (result.candid.isFirstCandid) {
        store.triggerFirstCandidCeremony(result.candid.imagePath);
      }

      // Refresh streak
      const { fetchCandidStreak } = await import('../../services/candidService');
      const streak = await fetchCandidStreak(coupleId);
      store.setCandidStreak(streak);

      setCaptionModalVisible(false);
      setSelectedImage(null);
      setCaption('');
    } else {
      Alert.alert('Oops', result.error || 'Failed to send candid.');
    }

    setSending(false);
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 120,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Vibration.vibrate(10);
    handlePickImage();
  };

  const handleQuickCapture = () => {
    Vibration.vibrate(15);
    handleCamera();
  };

  return (
    <>
      {!invisible && (
        <Animated.View style={[
          small ? styles.smallFabContainer : styles.fabContainer,
          { transform: [{ scale: scaleAnim }] }
        ]}>
          <TouchableOpacity
            style={[
              small ? styles.smallFab : styles.fab,
              { backgroundColor: colors.primary, ...Shadows.md }
            ]}
            onPress={handlePress}
            onLongPress={handleQuickCapture}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
            delayPressIn={0}
          >
            <Text style={small ? styles.smallFabIcon : styles.fabIcon}>📸</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Caption Modal */}
      <Modal visible={captionModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.captionBackdrop}
        >
          <View style={[styles.captionSheet, { backgroundColor: colors.cardBg || '#fff' }]}>
            <Text style={[styles.captionTitle, { color: colors.textPrimary }]}>
              Add a note ✍️
            </Text>
            <Text style={[styles.captionSubtitle, { color: colors.textMuted }]}>
              Optional — max 100 characters
            </Text>
            <TextInput
              style={[
                styles.captionInput,
                {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg || colors.creamDeep,
                  fontFamily: FontFamily.handwriting,
                },
              ]}
              value={caption}
              onChangeText={(text) => setCaption(text.slice(0, 100))}
              placeholder="Write something sweet..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={100}
              autoFocus
            />
            <View style={styles.captionActions}>
              <TouchableOpacity
                onPress={() => {
                  setCaptionModalVisible(false);
                  setSelectedImage(null);
                }}
                style={styles.captionCancel}
                delayPressIn={0}
              >
                <Text style={[styles.captionCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSend}
                disabled={sending}
                style={[
                  styles.captionSendBtn,
                  { backgroundColor: sending ? colors.textMuted : colors.primary },
                ]}
                delayPressIn={0}
              >
                <Text style={styles.captionSendText}>
                  {sending ? 'Sending...' : 'Send 💌'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});


const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 50,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 26,
  },
  smallFabContainer: {
    position: 'absolute',
    bottom: 0,
    left: -16,
    zIndex: 110,
  },
  smallFab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallFabIcon: {
    fontSize: 16,
  },
  captionBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captionSheet: {
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    padding: Space[6],
    paddingBottom: Space[10],
  },
  captionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.display,
    marginBottom: Space[1],
  },
  captionSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    marginBottom: Space[4],
  },
  captionInput: {
    fontSize: 20,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Space[4],
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space[5],
  },
  captionCancel: {
    paddingVertical: Space[3],
    paddingHorizontal: Space[4],
  },
  captionCancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.body,
  },
  captionSendBtn: {
    paddingVertical: Space[3],
    paddingHorizontal: Space[6],
    borderRadius: Radii.button,
  },
  captionSendText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.body,
  },
});

export default React.memo(CandidSendButton);
