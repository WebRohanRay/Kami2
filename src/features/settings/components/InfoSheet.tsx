import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Space } from '@shared/constants';
import { useTheme } from '@shared/hooks';

interface InfoSheetProps {
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export const InfoSheet: React.FC<InfoSheetProps> = ({
  visible,
  title,
  content,
  onClose,
}) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[sheetStyles.root, { backgroundColor: colors.pageBg }]}>
        <View style={sheetStyles.header}>
          <KamiText variant="title">{title}</KamiText>
          <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
            <KamiText variant="label" color={colors.primary} bold>Done</KamiText>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={sheetStyles.scroll}>
          <KamiText variant="body" style={sheetStyles.text}>{content}</KamiText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const sheetStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space[5],
    paddingVertical: Space[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '44',
  },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5] },
  text: { lineHeight: 24, color: Colors.textSecondary },
});
