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
import { Colors, Space, Radii, FontSize } from '@shared/constants';

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
  const [customText, setCustomText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('✨');

  const EMOJIS = ['✨', '🌸', '🌅', '🌺', '🌙', '☁️', '🌊', '🍂', '💖', '🥰', '🔥', '🥹', '😭', '🎉', '💤', '🍕', '🍿', '💻', '🎮', '🚗'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={[mm.root, { backgroundColor: colors.pageBg }]}>
        <View style={mm.handle} />
        <View style={mm.top}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>{selectedEmoji}</Text>
          <KamiText variant="title">Custom Status</KamiText>
          <KamiText variant="caption" color={Colors.textMuted} align="center" style={{ marginTop: 4 }}>
            Set a custom status for your partner to see.
          </KamiText>
        </View>

        {/* Emoji Picker row */}
        <View style={{ marginBottom: Space[4] }}>
          <KamiText variant="caption" color={Colors.textMuted} style={{ marginBottom: Space[2] }}>Select an emoji:</KamiText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space[2], paddingBottom: 4 }}>
            {EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                onPress={() => setSelectedEmoji(e)}
                style={[
                  styles.moodRingChip,
                  { borderColor: selectedEmoji === e ? colors.primary : Colors.border + '55' },
                  selectedEmoji === e && { backgroundColor: colors.primary + '11' }
                ]}
              >
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TextInput
          style={[mm.input, { height: 80 }]}
          placeholder="What are you up to…"
          placeholderTextColor={Colors.textMuted}
          value={customText}
          onChangeText={setCustomText}
          maxLength={40}
        />
        <View style={mm.btns}>
          <TouchableOpacity
            style={mm.skip}
            onPress={() => {
              setCustomText('');
              onClose();
            }}
          >
            <KamiText variant="label" color={Colors.textMuted}>Cancel</KamiText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[mm.save, { backgroundColor: colors.primary }]}
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

const mm = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg, paddingHorizontal: Space[5] },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: Space[3],
    marginBottom: Space[4],
  },
  top: { alignItems: 'center', gap: Space[2], marginBottom: Space[5] },
  input: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    height: 140,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlignVertical: 'top',
  },
  btns: { flexDirection: 'row', gap: Space[3], marginTop: Space[5] },
  skip: {
    flex: 1,
    height: 52,
    borderRadius: Radii.button,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: {
    flex: 2,
    height: 52,
    borderRadius: Radii.button,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const styles = StyleSheet.create({
  moodRingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space[3],
    paddingVertical: Space[2] - 2,
    borderRadius: Radii.full,
    borderWidth: 1.5,
    backgroundColor: '#FAF9F6',
  },
});
