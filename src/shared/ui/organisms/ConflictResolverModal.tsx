import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { Colors, Space, Radii, FontSize, FontWeight } from '@shared/constants';
import { useTheme } from '@shared/hooks';
import { db } from '@shared/db/client';
import * as schema from '@shared/db/schema';
import { eq } from 'drizzle-orm';
import { journalRepo, goalRepo, memoryRepo, letterRepo } from '@shared/db/repo';
import { enqueueMutation, processSyncQueue, fetchServerEntityById } from '@shared/db/sync';

interface ConflictResolverModalProps {
  visible: boolean;
  entityId: string;
  entityType: 'journal_entries' | 'goals' | 'memories' | 'future_letters';
  onClose: () => void;
  onResolve: () => void;
}

const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  visible,
  entityId,
  entityType,
  onClose,
  onResolve,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [localData, setLocalData] = useState<any>(null);
  const [serverData, setServerData] = useState<any>(null);

  useEffect(() => {
    if (visible && entityId) {
      loadData();
    }
  }, [visible, entityId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load local data
      let local: any = null;
      if (entityType === 'journal_entries') {
        local = await journalRepo.fetchJournalById(entityId);
      } else if (entityType === 'goals') {
        local = await goalRepo.fetchGoalById(entityId);
      } else if (entityType === 'memories') {
        local = await memoryRepo.fetchMemoryById(entityId);
      } else if (entityType === 'future_letters') {
        local = await letterRepo.fetchLetterById(entityId);
      }
      setLocalData(local);

      // 2. Load server data
      const server = await fetchServerEntityById(entityType, entityId);
      setServerData(server);
    } catch (err) {
      console.error('[ConflictResolver] Error loading data:', err);
      Alert.alert('Kami', 'Failed to load comparison data. Please check your internet connection.');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleKeepLocal = async () => {
    if (!localData || !serverData) return;
    setLoading(true);
    try {
      // Set local serverUpdatedAt to server's current updatedAt to resolve conflict mismatch
      const now = new Date().toISOString();
      const updatedFields = {
        ...localData,
        syncStatus: 'pending_update',
        serverUpdatedAt: serverData.updated_at,
        updatedAt: now,
      };

      if (entityType === 'journal_entries') {
        await journalRepo.saveJournal(updatedFields);
      } else if (entityType === 'goals') {
        await goalRepo.saveGoal(updatedFields);
      } else if (entityType === 'memories') {
        await memoryRepo.saveMemory(updatedFields);
      } else if (entityType === 'future_letters') {
        await letterRepo.saveLetter(updatedFields);
      }

      // Re-enqueue mutation to push local changes to server
      await enqueueMutation(entityType, entityId, 'update', updatedFields);

      // Clear the previously failed conflict outbox item
      await db.delete(schema.outboxMutations).where(
        eq(schema.outboxMutations.entityId, entityId)
      );

      // Re-trigger sync queue
      processSyncQueue().catch(e => console.error('Failed to run sync queue:', e));

      Alert.alert('Kami', 'Your local changes are saved and enqueued to overwrite the server.');
      onResolve();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Kami', 'Failed to save conflict resolution.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeepServer = async () => {
    if (!serverData) return;
    setLoading(true);
    try {
      // Overwrite local SQLite record with server values
      const now = new Date().toISOString();
      
      if (entityType === 'journal_entries') {
        await journalRepo.saveJournal({
          id: serverData.id,
          userId: serverData.user_id,
          title: serverData.title,
          body: serverData.body,
          moodId: serverData.mood_id,
          tags: serverData.tags || [],
          imageUrls: serverData.image_urls || [],
          entryDate: serverData.entry_date,
          isPinned: !!serverData.is_pinned,
          createdAt: serverData.created_at,
          updatedAt: serverData.updated_at,
          syncStatus: 'synced',
          serverUpdatedAt: serverData.updated_at,
        });
      } else if (entityType === 'goals') {
        await goalRepo.saveGoal({
          id: serverData.id,
          userId: serverData.user_id,
          title: serverData.title,
          description: serverData.description,
          category: serverData.category,
          status: serverData.status,
          progress: serverData.progress,
          targetDate: serverData.target_date,
          completedAt: serverData.completed_at,
          emoji: serverData.emoji,
          sortOrder: serverData.sort_order,
          imageUrl: serverData.image_url,
          createdAt: serverData.created_at,
          updatedAt: serverData.updated_at,
          syncStatus: 'synced',
          serverUpdatedAt: serverData.updated_at,
        });
      } else if (entityType === 'memories') {
        await memoryRepo.saveMemory({
          id: serverData.id,
          userId: serverData.user_id,
          title: serverData.title,
          body: serverData.body,
          emoji: serverData.emoji,
          mood: serverData.mood,
          imageUrls: serverData.image_urls || [],
          memoryDate: serverData.memory_date,
          createdAt: serverData.created_at,
          updatedAt: serverData.updated_at,
          syncStatus: 'synced',
          serverUpdatedAt: serverData.updated_at,
        });
      } else if (entityType === 'future_letters') {
        await letterRepo.saveLetter({
          id: serverData.id,
          userId: serverData.user_id,
          subject: serverData.subject,
          body: serverData.body,
          deliverAt: serverData.deliver_at,
          imageUrls: serverData.image_urls || [],
          createdAt: serverData.created_at,
          updatedAt: serverData.updated_at,
          isRead: serverData.is_read ? 1 : 0,
          isFavorite: serverData.is_favorite ? 1 : 0,
          isDraft: serverData.is_draft ? 1 : 0,
          isArchived: serverData.is_archived ? 1 : 0,
          syncStatus: 'synced',
          serverUpdatedAt: serverData.updated_at,
        });
      }

      // Clear outbox mutation for this entity
      await db.delete(schema.outboxMutations).where(
        eq(schema.outboxMutations.entityId, entityId)
      );

      Alert.alert('Kami', 'Device record updated to match the server version.');
      onResolve();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Kami', 'Failed to save conflict resolution.');
    } finally {
      setLoading(false);
    }
  };

  const renderComparisonFields = () => {
    if (!localData || !serverData) return null;

    if (entityType === 'journal_entries') {
      return (
        <View style={styles.comparisonContainer}>
          <View style={styles.column}>
            <Text style={styles.columnHeader}>Device Version</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Title</Text>
              <Text style={styles.fieldValue}>{localData.title || '(Empty)'}</Text>
              
              <Text style={styles.fieldLabel}>Body</Text>
              <Text style={styles.fieldValue}>{localData.body}</Text>

              <Text style={styles.fieldLabel}>Mood</Text>
              <Text style={styles.fieldValue}>{localData.moodId || 'None'}</Text>
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.columnHeader}>Server Version</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Title</Text>
              <Text style={styles.fieldValue}>{serverData.title || '(Empty)'}</Text>
              
              <Text style={styles.fieldLabel}>Body</Text>
              <Text style={styles.fieldValue}>{serverData.body}</Text>

              <Text style={styles.fieldLabel}>Mood</Text>
              <Text style={styles.fieldValue}>{serverData.mood_id || 'None'}</Text>
            </View>
          </View>
        </View>
      );
    }

    if (entityType === 'goals') {
      return (
        <View style={styles.comparisonContainer}>
          <View style={styles.column}>
            <Text style={styles.columnHeader}>Device Version</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Title</Text>
              <Text style={styles.fieldValue}>{localData.title}</Text>
              
              <Text style={styles.fieldLabel}>Description</Text>
              <Text style={styles.fieldValue}>{localData.description || '(Empty)'}</Text>

              <Text style={styles.fieldLabel}>Progress</Text>
              <Text style={styles.fieldValue}>{localData.progress}%</Text>
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.columnHeader}>Server Version</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Title</Text>
              <Text style={styles.fieldValue}>{serverData.title}</Text>
              
              <Text style={styles.fieldLabel}>Description</Text>
              <Text style={styles.fieldValue}>{serverData.description || '(Empty)'}</Text>

              <Text style={styles.fieldLabel}>Progress</Text>
              <Text style={styles.fieldValue}>{serverData.progress}%</Text>
            </View>
          </View>
        </View>
      );
    }

    // Default simple render
    return (
      <View style={styles.comparisonContainer}>
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Device Version</Text>
          <View style={styles.card}>
            <Text style={styles.fieldValue}>{JSON.stringify(localData, null, 2)}</Text>
          </View>
        </View>
        <View style={styles.column}>
          <Text style={styles.columnHeader}>Server Version</Text>
          <View style={styles.card}>
            <Text style={styles.fieldValue}>{JSON.stringify(serverData, null, 2)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Resolve Sync Conflict</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ fontSize: 20, color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.subtitle}>
              This item was modified on another device. Please review the differences and select which version to keep.
            </Text>

            {renderComparisonFields()}

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={handleKeepLocal}
                style={[styles.button, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.buttonText}>Keep My Device Version</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleKeepServer}
                style={[styles.button, { backgroundColor: Colors.creamDeep, borderWidth: 1.5, borderColor: colors.primary }]}
              >
                <Text style={[styles.buttonText, { color: colors.primary }]}>Keep Server Version</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default ConflictResolverModal;

const styles = StyleSheet.create({
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
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  closeBtn: { padding: Space[2] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Space[5], gap: Space[4] },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  comparisonContainer: {
    flexDirection: 'row',
    gap: Space[3],
    marginVertical: Space[2],
  },
  column: { flex: 1, gap: Space[2] },
  columnHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radii.card,
    padding: Space[4],
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 250,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    marginTop: Space[2],
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginTop: Space[1],
    lineHeight: 20,
  },
  actions: { gap: Space[3], marginTop: Space[5] },
  button: {
    paddingVertical: 14,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
});
