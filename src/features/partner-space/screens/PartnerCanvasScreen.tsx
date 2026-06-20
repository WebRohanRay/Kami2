import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import Canvas from '../components/Canvas';
import ReactionBar from '../components/ReactionBar';
import QuickComposeSheet from '../components/QuickComposeSheet';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';
import type { PartnerSpaceItem, NoteContent } from '../types';
import { QUICK_NOTES, MAX_CANVAS_ITEMS } from '../types';

/**
 * Screen 2 — Partner Canvas (Leave Something)
 * Full interactive cork board with bottom sheet for adding content.
 */
const PartnerCanvasScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const space = usePartnerSpaceStore((s) => s.space);
  const rawItems = usePartnerSpaceStore((s) => s.items);
  const items = useMemo(
    () => rawItems.filter((i) => !i.isDeleted && !i.disappeared && !i.isHidden && i.isScheduledPublished),
    [rawItems]
  );
  const permissions = usePartnerSpaceStore((s) => s.permissions);
  const addItemToStore = usePartnerSpaceStore((s) => s.addItem);
  const updateItemInStore = usePartnerSpaceStore((s) => s.updateItem);
  const pushUndo = usePartnerSpaceStore((s) => s.pushUndo);
  const undo = usePartnerSpaceStore((s) => s.undo);
  const redo = usePartnerSpaceStore((s) => s.redo);
  const undoStack = usePartnerSpaceStore((s) => s.undoStack);
  const redoStack = usePartnerSpaceStore((s) => s.redoStack);

  const [showComposeSheet, setShowComposeSheet] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PartnerSpaceItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Handle item updates (position/size changes)
  const handleItemUpdate = useCallback(async (updatedItem: PartnerSpaceItem) => {
    if (!permissions?.allowPartnerMove) {
      Alert.alert('Not allowed 💕', 'Moving and resizing is turned off for now.');
      return;
    }

    const previousItem = items.find((i) => i.id === updatedItem.id);
    if (previousItem) {
      pushUndo({ type: 'update', item: updatedItem, previousItem });
    }
    updateItemInStore(updatedItem);

    // Persist to server
    await SpaceService.updateItem(updatedItem.id, {
      positionX: updatedItem.positionX,
      positionY: updatedItem.positionY,
      width: updatedItem.width,
      height: updatedItem.height,
      zIndex: updatedItem.zIndex,
    });
  }, [items, permissions?.allowPartnerMove, pushUndo, updateItemInStore]);

  // Handle long press (reactions for owner, delete for controller)
  const handleItemLongPress = useCallback((item: PartnerSpaceItem) => {
    setSelectedItem(item);
    setShowReactionBar(true);
  }, []);

  // Handle tap (for gift reveal)
  const handleItemTap = useCallback(async (item: PartnerSpaceItem) => {
    if (item.type === 'gift' && !item.isGiftOpened) {
      // Open the gift!
      const res = await SpaceService.updateItem(item.id, { isGiftOpened: true });
      if (res.success) {
        updateItemInStore(res.data);
      }
    }
  }, [updateItemInStore]);

  // Handle reaction
  const handleReact = useCallback(async (emoji: string) => {
    if (!selectedItem) return;

    const res = await SpaceService.updateItem(selectedItem.id, {
      reactionEmoji: emoji,
      reactedBy: usePartnerSpaceStore.getState().myUserId || undefined,
    });

    if (res.success) {
      updateItemInStore(res.data);

      // Check if this triggers disappearing (after_reacted condition)
      if (res.data.disappearCondition === 'after_reacted') {
        await SpaceService.markItemDisappeared(res.data.id);
      }
    }

    setShowReactionBar(false);
    setSelectedItem(null);
  }, [selectedItem, updateItemInStore]);

  // Save canvas → create snapshot
  const handleSave = useCallback(async () => {
    if (!space) return;
    setIsSaving(true);

    await SpaceService.createSnapshot(
      space.id,
      items,
      space.nickname,
      space.theme,
      'manual'
    );

    setIsSaving(false);
    usePartnerSpaceStore.getState().setToast({
      title: 'Saved!',
      message: 'Your changes are live on their widget ❤️',
      icon: '✨',
    });
  }, [space, items]);

  // Handle goodnight mode
  const handleGoodnight = useCallback(async () => {
    if (!space) return;

    // Android doesn't support Alert.prompt, so we use a default message
    // In production, this would use a custom TextInput modal
    const defaultMessage = 'Sweet dreams, love 🌙';

    Alert.alert(
      'Goodnight Mode 🌙',
      'Dim the widget and leave a sweet goodnight message?',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Goodnight 🌙',
          onPress: async () => {
            const res = await SpaceService.activateGoodnight(space.id, defaultMessage);
            if (res.success) {
              usePartnerSpaceStore.getState().setSpace(res.data);
            }
          },
        },
      ]
    );
  }, [space]);

  const handleQuickNote = useCallback(async (note: typeof QUICK_NOTES[number]) => {
    if (!space) return;
    if (!permissions?.allowNotes) {
      Alert.alert('Not right now', 'Notes are turned off for this widget.');
      return;
    }
    if (items.length >= MAX_CANVAS_ITEMS) {
      Alert.alert('Canvas is full', 'Remove some items to add more.');
      return;
    }

    const res = await SpaceService.addItem(space.id, 'note', {
      text: note.text,
      color: 'yellow',
      fontStyle: 'handwritten',
    } as NoteContent);
    if (res.success) {
      addItemToStore(res.data);
      pushUndo({ type: 'add', item: res.data });
    }
  }, [addItemToStore, items.length, permissions?.allowNotes, pushUndo, space]);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      {/* Top bar */}
      <View
        style={[styles.topBar, { borderBottomColor: colors.divider }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {space?.nickname || 'Canvas'}
        </Text>

        <View style={styles.topBarRight}>
          {/* Undo/Redo */}
          <TouchableOpacity
            onPress={() => undo()}
            disabled={undoStack.length === 0}
            style={[styles.undoRedoBtn, undoStack.length === 0 && styles.disabled]}
          >
            <Text style={styles.undoRedoText}>↩️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => redo()}
            disabled={redoStack.length === 0}
            style={[styles.undoRedoBtn, redoStack.length === 0 && styles.disabled]}
          >
            <Text style={styles.undoRedoText}>↪️</Text>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.saveBtnText}>
              {isSaving ? '...' : 'Save ✨'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <ScrollView
        contentContainerStyle={styles.canvasScroll}
        showsVerticalScrollIndicator={false}
      >
        <Canvas
          editable={true}
          onItemUpdate={handleItemUpdate}
          onItemLongPress={handleItemLongPress}
          onItemTap={handleItemTap}
        />

        {/* Item count */}
        <Text style={[styles.itemCount, { color: colors.textMuted }]}>
          {items.length} / {MAX_CANVAS_ITEMS} items
        </Text>
      </ScrollView>

      {/* Bottom action strip */}
      <View
        style={[styles.bottomStrip, { backgroundColor: colors.cardBg, borderTopColor: colors.divider }]}
      >
        {/* Quick notes row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickNotesRow}>
          {QUICK_NOTES.map((note, i) => (
            <TouchableOpacity
              key={i}
              onPress={async () => {
                if (!space) return;
                if (!permissions?.allowNotes) {
                  Alert.alert('Not right now', 'Notes are turned off for this widget.');
                  return;
                }
                if (items.length >= MAX_CANVAS_ITEMS) {
                  Alert.alert('Canvas is full 💕', 'Remove some items to add more.');
                  return;
                }
                const res = await SpaceService.addItem(space.id, 'note', {
                  text: note.text,
                  color: 'yellow',
                  fontStyle: 'handwritten',
                } as NoteContent);
                if (res.success) {
                  addItemToStore(res.data);
                  pushUndo({ type: 'add', item: res.data });
                }
              }}
              style={[styles.quickNote, { backgroundColor: colors.creamDeep }]}
            >
              <Text style={styles.quickNoteText}>{note.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content type buttons */}
        <View style={styles.contentButtons}>
          <TouchableOpacity
            onPress={() => setShowComposeSheet(true)}
            style={[styles.contentBtn, { backgroundColor: colors.primary + '15' }]}
          >
            <Text style={styles.contentBtnEmoji}>📸</Text>
            <Text style={[styles.contentBtnLabel, { color: colors.primary }]}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowComposeSheet(true)}
            style={[styles.contentBtn, { backgroundColor: colors.primary + '15' }]}
          >
            <Text style={styles.contentBtnEmoji}>💌</Text>
            <Text style={[styles.contentBtnLabel, { color: colors.primary }]}>Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowComposeSheet(true)}
            style={[styles.contentBtn, { backgroundColor: colors.primary + '15' }]}
          >
            <Text style={styles.contentBtnEmoji}>😊</Text>
            <Text style={[styles.contentBtnLabel, { color: colors.primary }]}>Sticker</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowComposeSheet(true)}
            style={[styles.contentBtn, { backgroundColor: colors.primary + '15' }]}
          >
            <Text style={styles.contentBtnEmoji}>🎁</Text>
            <Text style={[styles.contentBtnLabel, { color: colors.primary }]}>Gift</Text>
          </TouchableOpacity>
        </View>

        {/* Special actions */}
        <View style={styles.specialActions}>
          <TouchableOpacity onPress={handleGoodnight} style={styles.specialBtn}>
            <Text style={styles.specialBtnText}>🌙 Goodnight</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reaction bar overlay */}
      {showReactionBar && selectedItem && (
        <ReactionBar
          currentReaction={selectedItem.reactionEmoji}
          onReact={handleReact}
          onDismiss={() => {
            setShowReactionBar(false);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Quick compose bottom sheet */}
      {showComposeSheet && (
        <QuickComposeSheet
          onDismiss={() => setShowComposeSheet(false)}
          onItemAdded={(item) => {
            addItemToStore(item);
            pushUndo({ type: 'add', item });
            setShowComposeSheet(false);
          }}
        />
      )}
    </View>
  );
};

export default PartnerCanvasScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Space[12],
    paddingBottom: Space[3],
    paddingHorizontal: Space[4],
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Space[2],
  },
  backText: {
    fontSize: FontSize.base,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamily.display,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
  },
  undoRedoBtn: {
    padding: Space[1],
  },
  undoRedoText: {
    fontSize: 20,
  },
  disabled: {
    opacity: 0.3,
  },
  saveBtn: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.button,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  canvasScroll: {
    alignItems: 'center',
    paddingVertical: Space[4],
    flexGrow: 1,
  },
  itemCount: {
    fontSize: FontSize.xs,
    marginTop: Space[2],
  },
  bottomStrip: {
    borderTopWidth: 1,
    paddingHorizontal: Space[4],
    paddingTop: Space[3],
    paddingBottom: Space[8],
  },
  quickNotesRow: {
    marginBottom: Space[3],
  },
  quickNote: {
    paddingHorizontal: Space[3],
    paddingVertical: Space[2],
    borderRadius: Radii.full,
    marginRight: Space[2],
  },
  quickNoteText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.handwriting,
  },
  contentButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space[2],
    marginBottom: Space[3],
  },
  contentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space[2],
    borderRadius: Radii.lg,
    gap: 2,
  },
  contentBtnEmoji: {
    fontSize: 22,
  },
  contentBtnLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  specialActions: {
    flexDirection: 'row',
    gap: Space[3],
  },
  specialBtn: {
    flex: 1,
    paddingVertical: Space[2],
    alignItems: 'center',
  },
  specialBtnText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.handwriting,
  },
});
