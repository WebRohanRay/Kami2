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
import { Space } from '@shared/constants';
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
  const styles = getStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <KamiText variant="title">{title}</KamiText>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <KamiText variant="label" color={colors.primary} bold>Done</KamiText>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <KamiText variant="body" style={styles.text}>{content}</KamiText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.pageBg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Space[5],
      paddingVertical: Space[4],
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '44',
    },
    closeBtn: { padding: Space[2] },
    scroll: { padding: Space[5] },
    text: { lineHeight: 24, color: colors.textSecondary },
  });
