import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, FontSize, FontWeight, Radii, Space, FontFamily } from '@shared/constants';

interface PromptModalProps {
  visible: boolean;
  prompt: string;
  existing?: string;
  onClose: () => void;
  onSave: (r: string) => Promise<void>;
  saving: boolean;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  visible,
  prompt,
  existing,
  onClose,
  onSave,
  saving,
}) => {
  const { colors } = useTheme();
  const [response, setResponse] = useState(existing ?? '');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (visible) setResponse(existing ?? '');
  }, [visible, existing]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[pm.root, { backgroundColor: colors.pageBg }]}>
        <View style={pm.toolbar}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <KamiText variant="label" color={Colors.textMuted}>Close</KamiText>
          </TouchableOpacity>
          <KamiText variant="overline">Today's Reflection</KamiText>
          <TouchableOpacity
            onPress={() => {
              if (response.trim()) {
                Keyboard.dismiss();
                onSave(response.trim());
              }
            }}
            disabled={saving || !response.trim()}
            hitSlop={8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <KamiText variant="label" color={response.trim() ? colors.primary : Colors.textMuted} bold>Save</KamiText>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={pm.content}>
          <View style={[pm.promptBox, { backgroundColor: colors.primary + '11', borderLeftColor: colors.primary, borderColor: colors.primary + '33' }]}>
            <Text style={[pm.quoteMark, { color: colors.primary + '44' }]}>"</Text>
            <KamiText variant="body" style={{ fontStyle: 'italic', lineHeight: 26 }}>{prompt}</KamiText>
          </View>
          <TextInput
            style={[pm.input, { borderColor: focused ? colors.primary : Colors.border }]}
            placeholder="Write your thoughts…"
            placeholderTextColor={Colors.textMuted}
            value={response}
            onChangeText={setResponse}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={2000}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <KamiText variant="caption" color={Colors.textMuted} align="right">{response.length} / 2000</KamiText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const pm = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingVertical: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  content: { padding: Space[5], gap: Space[4] },
  promptBox: { borderRadius: Radii.card, padding: Space[5], borderLeftWidth: 3, borderWidth: 1 },
  quoteMark: { fontSize: 40, lineHeight: 40, fontFamily: FontFamily.display },
  input: { backgroundColor: Colors.cardBg, borderRadius: Radii.card, padding: Space[4], fontSize: FontSize.base, color: Colors.textPrimary, minHeight: 220, borderWidth: 1.5, lineHeight: 24 },
});
