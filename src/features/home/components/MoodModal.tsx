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
  Keyboard,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Space, Radii, FontSize } from '@shared/constants';
import { MOODS } from '../hooks/useHomeDashboard';

interface MoodModalProps {
  visible: boolean;
  mood: typeof MOODS[0] | null;
  onClose: () => void;
  onSave: (note: string) => Promise<void>;
  saving: boolean;
}

export const MoodModal: React.FC<MoodModalProps> = ({
  visible,
  mood,
  onClose,
  onSave,
  saving,
}) => {
  const { colors } = useTheme();
  const [note, setNote] = useState('');
  if (!mood) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={[mm.root, { backgroundColor: colors.pageBg }]}>
        <View style={mm.handle} />
        <View style={mm.top}>
          <Text style={mm.emoji}>{mood.emoji}</Text>
          <KamiText variant="title">{mood.label}</KamiText>
          <KamiText variant="caption" color={Colors.textMuted} align="center" style={{ marginTop: 4 }}>
            Want to add a note about how you're feeling?
          </KamiText>
        </View>
        <TextInput
          style={mm.input}
          placeholder="What's on your mind…"
          placeholderTextColor={Colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          textAlignVertical="top"
          maxLength={400}
        />
        <View style={mm.btns}>
          <TouchableOpacity
            style={mm.skip}
            onPress={() => {
              setNote('');
              onClose();
            }}
          >
            <KamiText variant="label" color={Colors.textMuted}>Skip</KamiText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[mm.save, { backgroundColor: colors.primary }]}
            disabled={saving}
            onPress={() => {
              Keyboard.dismiss();
              onSave(note.trim()).then(() => setNote(''));
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <KamiText variant="label" color="#fff">Save mood</KamiText>
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
  emoji: { fontSize: 56 },
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
