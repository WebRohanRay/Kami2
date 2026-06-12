import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useTheme } from '@shared/hooks';
import { useAuthStore } from '@features/auth';
import KamiText from '@shared/ui/atoms/KamiText';
import { Colors, Space, Radii, FontSize } from '@shared/constants';

import type { CoupleJournal, CoupleComment } from '@features/couple/types';

interface CommentsModalProps {
  visible: boolean;
  entry: CoupleJournal | null;
  onClose: () => void;
  onAddComment: (entryId: string, text: string) => Promise<void>;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  entry,
  onClose,
  onAddComment,
}) => {
  const { colors } = useTheme();
  const user = useAuthStore(s => s.user);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!entry) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[cm.root, { backgroundColor: colors.pageBg }]}>
        <View style={cm.header}>
          <KamiText variant="title">Comments</KamiText>
          <TouchableOpacity onPress={onClose} style={cm.closeBtn}>
            <KamiText variant="label" color={colors.primary} bold>Close</KamiText>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={cm.scroll} keyboardShouldPersistTaps="handled">
          <View style={[cm.entrySummary, { backgroundColor: colors.creamDeep + '15' }]}>
            <KamiText variant="label" bold>{entry.title || 'Shared Entry'}</KamiText>
            <KamiText variant="caption" color={Colors.textSecondary} numberOfLines={3}>{entry.body}</KamiText>
          </View>
          <View style={cm.commentsList}>
            {(entry.comments ?? []).length === 0 ? (
              <KamiText variant="caption" color={Colors.textMuted} align="center" style={{ marginVertical: Space[4] }}>
                No comments yet. Leave a sweet note!
              </KamiText>
            ) : (
              (entry.comments ?? []).map((c: any) => {
                const isMe = c.userId === user?.id;
                return (
                  <View
                    key={c.id}
                    style={[
                      cm.commentBubbleWrap,
                      isMe ? cm.commentBubbleWrapRight : cm.commentBubbleWrapLeft
                    ]}
                  >
                    <View
                      style={[
                        cm.commentBubble,
                        isMe
                          ? [cm.commentBubbleRight, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '22' }]
                          : [cm.commentBubbleLeft, { backgroundColor: '#F1F5F9', borderColor: 'rgba(0,0,0,0.03)' }]
                      ]}
                    >
                      <View style={cm.commentBubbleHeader}>
                        <KamiText variant="caption" color={isMe ? colors.primaryDark : Colors.textPrimary} bold style={{ fontSize: 10 }}>
                          {isMe ? 'You' : c.userNickname}
                        </KamiText>
                        <KamiText variant="caption" color={Colors.textMuted} style={{ fontSize: 8 }}>
                          {new Date(c.createdAt).toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: user?.timezone ?? 'UTC' })}
                        </KamiText>
                      </View>
                      <KamiText variant="body" color={Colors.textSecondary} style={{ fontSize: FontSize.sm, lineHeight: 18 }}>{c.body}</KamiText>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
        <View style={[cm.inputRow, { borderTopColor: Colors.border + '44' }]}>
          <TextInput
            style={[cm.input, { borderColor: colors.primary + '22', backgroundColor: colors.creamDeep + '11' }]}
            placeholder="Write a comment..."
            placeholderTextColor={Colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={250}
          />
          <TouchableOpacity
            style={[cm.sendBtn, { backgroundColor: colors.primary }]}
            disabled={!commentText.trim() || submitting}
            onPress={async () => {
              setSubmitting(true);
              await onAddComment(entry.id, commentText.trim());
              setCommentText('');
              setSubmitting(false);
            }}
          >
            <KamiText variant="caption" color="#fff" bold>Send</KamiText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const cm = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.pageBg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Space[5], paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight ?? 24) + Space[2], paddingBottom: Space[4], borderBottomWidth: 1, borderBottomColor: Colors.border + '44' },
  closeBtn: { padding: Space[2] },
  scroll: { padding: Space[5] },
  entrySummary: { padding: Space[4], borderRadius: Radii.card, gap: Space[1], marginBottom: Space[4], borderWidth: 1, borderColor: Colors.border + '22' },
  commentsList: { gap: Space[3] },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: Space[3], gap: Space[2], borderTopWidth: 1 },
  input: { flex: 1, height: 42, borderRadius: Radii.input, borderWidth: 1, paddingHorizontal: Space[3], color: Colors.textPrimary, fontSize: FontSize.sm },
  sendBtn: { paddingVertical: Space[2] + 2, paddingHorizontal: Space[4], borderRadius: Radii.full },

  // Bubble comments styling
  commentBubbleWrap: {
    width: '100%',
    flexDirection: 'row',
    marginVertical: 4,
  },
  commentBubbleWrapRight: {
    justifyContent: 'flex-end',
  },
  commentBubbleWrapLeft: {
    justifyContent: 'flex-start',
  },
  commentBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
  },
  commentBubbleRight: {
    borderBottomRightRadius: 4,
  },
  commentBubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  commentBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Space[3],
    marginBottom: 2,
  },
});
