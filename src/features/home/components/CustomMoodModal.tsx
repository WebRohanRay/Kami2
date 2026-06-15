import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import KamiText from '@shared/ui/atoms/KamiText';
import { Space, Radii, FontSize } from '@shared/constants';

interface CustomMoodModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (emoji: string, text: string) => Promise<void>;
  saving: boolean;
}

export const CustomMoodModal: React.FC<CustomMoodModalProps> = ({
  visible,
  onClose,
  onSave,
  saving,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [customText, setCustomText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('✨');

  const EMOJIS = ['✨', '🌸', '🌅', '🌺', '🌙', '☁️', '🌊', '🍂', '💖', '🥰', '🔥', '🥹', '😭', '🎉', '💤', '🍕', '🍿', '💻', '🎮', '🚗'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }]}>
        <View style={styles.handle} />
        <View style={styles.top}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>{selectedEmoji}</Text>
          <KamiText variant="title">Custom Status</KamiText>
          <KamiText variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 4 }}>
            Set a custom status for your partner to see.
          </KamiText>
        </View>

        {/* Emoji Picker row */}
        <View style={{ marginBottom: Space[4] }}>
          <KamiText variant="caption" color={colors.textMuted} style={{ marginBottom: Space[2] }}>Select an emoji:</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space[2], paddingBottom: 4 }}>
            {EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                onPress={() => setSelectedEmoji(e)}
                style={[
                  styles.moodRingChip,
                  { borderColor: selectedEmoji === e ? colors.primary : colors.border + '55' },
                  selectedEmoji === e && { backgroundColor: colors.primary + '11' }
                ]}
              >
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="What are you up to…"
          placeholderTextColor={colors.textMuted}
          value={customText}
          onChangeText={setCustomText}
          maxLength={40}
        />
        <View style={styles.btns}>
          <TouchableOpacity
            style={styles.skip}
            onPress={() => {
              setCustomText('');
              onClose();
            }}
          >
            <KamiText variant="label" color={colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.save, { backgroundColor: colors.primary }]}
            disabled={saving}
            onPress={() => {
              Keyboard.dismiss();
              onSave(selectedEmoji, customText.trim());
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <KamiText variant="label" color="#fff">Set Status</KamiText>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg, paddingHorizontal: Space[5] },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: Space[3],
    marginBottom: Space[4],
  },
  top: { alignItems: 'center', gap: Space[2], marginBottom: Space[5] },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    fontSize: FontSize.base,
    color: colors.textPrimary,
    height: 140,
    borderWidth: 1.5,
    borderColor: colors.border,
    textAlignVertical: 'top',
  },
  btns: { flexDirection: 'row', gap: Space[3], marginTop: Space[5] },
  skip: {
    flex: 1,
    height: 52,
    borderRadius: Radii.button,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: {
    flex: 2,
    height: 52,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodRingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space[3],
    paddingVertical: Space[2] - 2,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    backgroundColor: colors.inputBg,
  },
});
