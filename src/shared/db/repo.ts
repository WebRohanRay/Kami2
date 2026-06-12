import { db } from './client';
import * as schema from './schema';
import { eq, and, isNull, sql, like, or, desc, asc } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

// ==========================================
// DB Model & Input Types
// ==========================================
export interface ProfileModel {
  id: string;
  email: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  theme: string;
  textSize: string;
  dailyReminderEnabled: boolean;
  weeklyDigestEnabled: boolean;
  streakAlertsEnabled: boolean;
  pushToken: string | null;
  timezone: string | null;
  kamiId: string | null;
  activeSpace: string | null;
  currentMoodLabel: string | null;
  currentMoodEmoji: string | null;
  lastSeenAt: string | null;
  heroBgUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProfileInput {
  id: string;
  email?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  theme?: string;
  textSize?: string;
  dailyReminderEnabled?: boolean | number;
  weeklyDigestEnabled?: boolean | number;
  streakAlertsEnabled?: boolean | number;
  dailyReminder?: boolean | number;
  weeklyDigest?: boolean | number;
  streakAlerts?: boolean | number;
  pushToken?: string | null;
  timezone?: string | null;
  kamiId?: string | null;
  activeSpace?: string | null;
  currentMoodLabel?: string | null;
  currentMoodEmoji?: string | null;
  lastSeenAt?: string | null;
  heroBgUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MoodInput {
  id: string;
  userId: string;
  moodId: string;
  moodEmoji: string;
  moodLabel: string;
  note?: string | null;
  loggedDate: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: string;
  serverUpdatedAt?: string | null;
  deletedAt?: string | null;
}

export interface JournalEntryModel {
  id: string;
  userId: string;
  title: string | null;
  body: string;
  moodId: string | null;
  tags: string[];
  imageUrls: string[];
  entryDate: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: string;
  serverUpdatedAt: string | null;
}

export interface JournalInput {
  id: string;
  userId: string;
  title?: string | null;
  body: string;
  moodId?: string | null;
  tags?: string[] | string;
  imageUrls?: string[] | string;
  entryDate: string;
  isPinned?: boolean | number;
  createdAt: string;
  updatedAt: string;
  syncStatus?: string;
  serverUpdatedAt?: string | null;
  deletedAt?: string | null;
}

export interface GoalInput {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  category?: string;
  status?: string;
  progress?: number;
  targetDate?: string | null;
  completedAt?: string | null;
  emoji?: string;
  sortOrder?: number;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: string;
  serverUpdatedAt?: string | null;
  deletedAt?: string | null;
}

export interface MemoryModel {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  emoji: string;
  mood: string | null;
  imageUrls: string[];
  memoryDate: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: string;
  serverUpdatedAt: string | null;
  deletedAt?: string | null;
}

export interface MemoryInput {
  id: string;
  userId: string;
  title: string;
  body?: string | null;
  emoji?: string;
  mood?: string | null;
  imageUrls?: string[] | string;
  memoryDate: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: string;
  serverUpdatedAt?: string | null;
  deletedAt?: string | null;
}

export interface LetterModel {
  id: string;
  userId: string;
  subject: string;
  deliverAt: string;
  isUnlocked: boolean;
  createdAt: string;
  updatedAt: string | null;
  isRead: boolean;
  isFavorite: boolean;
  isDraft: boolean;
  isArchived: boolean;
  syncStatus: string;
  serverUpdatedAt: string | null;
}

export interface LetterModelDetail extends LetterModel {
  body: string;
  imageUrls: string[];
  deletedAt: string | null;
}

export interface LetterInput {
  id: string;
  userId: string;
  subject: string;
  body: string;
  deliverAt: string;
  imageUrls?: string[] | string;
  createdAt: string;
  updatedAt?: string | null;
  isRead?: boolean | number;
  isFavorite?: boolean | number;
  isDraft?: boolean | number;
  isArchived?: boolean | number;
  syncStatus?: string;
  serverUpdatedAt?: string | null;
  deletedAt?: string | null;
}

// Helper to stringify arrays
const toJSON = (val: unknown[] | string | null | undefined): string => {
  if (!val) return '[]';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
};

const fromJSON = (val: string | null): string[] => {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
};

// Helper for boolean to integer conversions
const toInt = (val: boolean | number | undefined): number | undefined => {
  if (val === undefined) return undefined;
  if (typeof val === 'number') return val;
  return val ? 1 : 0;
};
const fromInt = (val: number | null): boolean => !!val;

// ==========================================
// Profiles Repository
// ==========================================
export const profileRepo = {
  async fetchProfile(id: string): Promise<ProfileModel | null> {
    const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, id));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      email: r.email,
      nickname: r.nickname,
      avatarUrl: r.avatarUrl,
      theme: r.theme,
      textSize: r.textSize,
      dailyReminderEnabled: fromInt(r.dailyReminderEnabled),
      weeklyDigestEnabled: fromInt(r.weeklyDigestEnabled),
      streakAlertsEnabled: fromInt(r.streakAlertsEnabled),
      pushToken: r.pushToken,
      timezone: r.timezone,
      kamiId: r.kamiId,
      activeSpace: r.activeSpace,
      currentMoodLabel: r.currentMoodLabel,
      currentMoodEmoji: r.currentMoodEmoji,
      lastSeenAt: r.lastSeenAt,
      heroBgUrl: r.heroBgUrl,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  },

  async upsertProfile(r: ProfileInput): Promise<void> {
    await db
      .insert(schema.profiles)
      .values({
        id: r.id,
        email: r.email,
        nickname: r.nickname,
        avatarUrl: r.avatarUrl,
        theme: r.theme,
        textSize: r.textSize,
        dailyReminderEnabled: toInt(r.dailyReminderEnabled) ?? 1,
        weeklyDigestEnabled: toInt(r.weeklyDigestEnabled) ?? 0,
        streakAlertsEnabled: toInt(r.streakAlertsEnabled) ?? 1,
        pushToken: r.pushToken,
        timezone: r.timezone,
        kamiId: r.kamiId,
        activeSpace: r.activeSpace,
        currentMoodLabel: r.currentMoodLabel,
        currentMoodEmoji: r.currentMoodEmoji,
        lastSeenAt: r.lastSeenAt,
        heroBgUrl: r.heroBgUrl,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.profiles.id,
        set: {
          email: r.email,
          nickname: r.nickname,
          avatarUrl: r.avatarUrl,
          theme: r.theme,
          textSize: r.textSize,
          dailyReminderEnabled: toInt(r.dailyReminderEnabled) ?? 1,
          weeklyDigestEnabled: toInt(r.weeklyDigestEnabled) ?? 0,
          streakAlertsEnabled: toInt(r.streakAlertsEnabled) ?? 1,
          pushToken: r.pushToken,
          timezone: r.timezone,
          kamiId: r.kamiId,
          activeSpace: r.activeSpace,
          currentMoodLabel: r.currentMoodLabel,
          currentMoodEmoji: r.currentMoodEmoji,
          lastSeenAt: r.lastSeenAt,
          heroBgUrl: r.heroBgUrl,
          updatedAt: r.updatedAt,
        },
      });
  },

  async updateProfile(id: string, patch: Partial<ProfileInput>): Promise<void> {
    const updateValues: Record<string, any> = {};
    if (patch.nickname !== undefined) updateValues.nickname = patch.nickname;
    if (patch.avatarUrl !== undefined) updateValues.avatarUrl = patch.avatarUrl;
    if (patch.theme !== undefined) updateValues.theme = patch.theme;
    if (patch.textSize !== undefined) updateValues.textSize = patch.textSize;
    if (patch.dailyReminderEnabled !== undefined) updateValues.dailyReminderEnabled = toInt(patch.dailyReminderEnabled);
    if (patch.weeklyDigestEnabled !== undefined) updateValues.weeklyDigestEnabled = toInt(patch.weeklyDigestEnabled);
    if (patch.streakAlertsEnabled !== undefined) updateValues.streakAlertsEnabled = toInt(patch.streakAlertsEnabled);
    if (patch.pushToken !== undefined) updateValues.pushToken = patch.pushToken;
    if (patch.timezone !== undefined) updateValues.timezone = patch.timezone;
    if (patch.kamiId !== undefined) updateValues.kamiId = patch.kamiId;
    if (patch.activeSpace !== undefined) updateValues.activeSpace = patch.activeSpace;
    if (patch.currentMoodLabel !== undefined) updateValues.currentMoodLabel = patch.currentMoodLabel;
    if (patch.currentMoodEmoji !== undefined) updateValues.currentMoodEmoji = patch.currentMoodEmoji;
    if (patch.lastSeenAt !== undefined) updateValues.lastSeenAt = patch.lastSeenAt;
    if (patch.heroBgUrl !== undefined) updateValues.heroBgUrl = patch.heroBgUrl;
    if (patch.updatedAt !== undefined) updateValues.updatedAt = patch.updatedAt;

    await db.update(schema.profiles).set(updateValues).where(eq(schema.profiles.id, id));
  },
};

// ==========================================
// Mood Logs Repository
// ==========================================
export const moodRepo = {
  async fetchTodayMood(userId: string, loggedDate: string): Promise<InferSelectModel<typeof schema.moodLogs> | null> {
    const rows = await db
      .select()
      .from(schema.moodLogs)
      .where(
        and(
          eq(schema.moodLogs.userId, userId),
          eq(schema.moodLogs.loggedDate, loggedDate),
          isNull(schema.moodLogs.deletedAt)
        )
      );
    return rows.length > 0 ? rows[0] : null;
  },

  async fetchRecentMoods(userId: string, sinceDate: string): Promise<InferSelectModel<typeof schema.moodLogs>[]> {
    return db
      .select()
      .from(schema.moodLogs)
      .where(
        and(
          eq(schema.moodLogs.userId, userId),
          sql`${schema.moodLogs.loggedDate} >= ${sinceDate}`,
          isNull(schema.moodLogs.deletedAt)
        )
      )
      .orderBy(asc(schema.moodLogs.loggedDate));
  },

  async upsertMood(r: MoodInput): Promise<void> {
    await db
      .insert(schema.moodLogs)
      .values({
        id: r.id,
        userId: r.userId,
        moodId: r.moodId,
        moodEmoji: r.moodEmoji,
        moodLabel: r.moodLabel,
        note: r.note,
        loggedDate: r.loggedDate,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        syncStatus: r.syncStatus || 'synced',
        serverUpdatedAt: r.serverUpdatedAt,
      })
      .onConflictDoUpdate({
        target: [schema.moodLogs.userId, schema.moodLogs.loggedDate],
        set: {
          moodId: r.moodId,
          moodEmoji: r.moodEmoji,
          moodLabel: r.moodLabel,
          note: r.note,
          updatedAt: r.updatedAt,
          syncStatus: r.syncStatus || 'synced',
          serverUpdatedAt: r.serverUpdatedAt,
          deletedAt: null, // Clear deleted status on re-upsert
        },
      });
  },
};

// ==========================================
// Journal Entries Repository
// ==========================================
export const journalRepo = {
  async fetchJournals(userId: string, searchQuery?: string, tagFilter?: string, page = 1, limit = 20): Promise<JournalEntryModel[]> {
    const conditions = [
      eq(schema.journalEntries.userId, userId),
      isNull(schema.journalEntries.deletedAt),
    ];

    if (tagFilter) {
      // Drizzle sqlite has like
      conditions.push(like(schema.journalEntries.tags, `%"${tagFilter}"%`));
    }

    if (searchQuery) {
      const searchOr = or(
        like(schema.journalEntries.title, `%${searchQuery}%`),
        like(schema.journalEntries.body, `%${searchQuery}%`)
      );
      if (searchOr) conditions.push(searchOr);
    }

    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(schema.journalEntries)
      .where(and(...conditions))
      .orderBy(desc(schema.journalEntries.entryDate), desc(schema.journalEntries.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      body: r.body,
      moodId: r.moodId,
      tags: fromJSON(r.tags),
      imageUrls: fromJSON(r.imageUrls),
      entryDate: r.entryDate,
      isPinned: fromInt(r.isPinned),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }));
  },

  async fetchJournalById(id: string): Promise<(JournalEntryModel & { deletedAt: string | null }) | null> {
    const rows = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      body: r.body,
      moodId: r.moodId,
      tags: fromJSON(r.tags),
      imageUrls: fromJSON(r.imageUrls),
      entryDate: r.entryDate,
      isPinned: fromInt(r.isPinned),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
      deletedAt: r.deletedAt,
    };
  },

  async saveJournal(r: JournalInput): Promise<void> {
    await db
      .insert(schema.journalEntries)
      .values({
        id: r.id,
        userId: r.userId,
        title: r.title ?? null,
        body: r.body,
        moodId: r.moodId ?? null,
        tags: toJSON(r.tags),
        imageUrls: toJSON(r.imageUrls),
        entryDate: r.entryDate,
        isPinned: toInt(r.isPinned) ?? 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        syncStatus: r.syncStatus || 'synced',
        serverUpdatedAt: r.serverUpdatedAt,
      })
      .onConflictDoUpdate({
        target: schema.journalEntries.id,
        set: {
          title: r.title ?? null,
          body: r.body,
          moodId: r.moodId ?? null,
          tags: toJSON(r.tags),
          imageUrls: toJSON(r.imageUrls),
          entryDate: r.entryDate,
          isPinned: toInt(r.isPinned) ?? 0,
          updatedAt: r.updatedAt,
          syncStatus: r.syncStatus || 'synced',
          serverUpdatedAt: r.serverUpdatedAt,
          deletedAt: r.deletedAt || null,
        },
      });
  },

  async softDeleteJournal(id: string, deletedAt: string): Promise<void> {
    await db
      .update(schema.journalEntries)
      .set({
        deletedAt,
        syncStatus: 'pending_update', // Marks it for sync processing
      })
      .where(eq(schema.journalEntries.id, id));
  },
};

// ==========================================
// Goals Repository
// ==========================================
export const goalRepo = {
  async fetchGoals(userId: string): Promise<InferSelectModel<typeof schema.goals>[]> {
    const rows = await db
      .select()
      .from(schema.goals)
      .where(and(eq(schema.goals.userId, userId), isNull(schema.goals.deletedAt)))
      .orderBy(asc(schema.goals.sortOrder), desc(schema.goals.createdAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      progress: r.progress,
      targetDate: r.targetDate,
      completedAt: r.completedAt,
      emoji: r.emoji,
      sortOrder: r.sortOrder,
      imageUrl: r.imageUrl,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
      deletedAt: r.deletedAt,
    }));
  },

  async fetchGoalById(id: string): Promise<InferSelectModel<typeof schema.goals> | null> {
    const rows = await db.select().from(schema.goals).where(eq(schema.goals.id, id));
    if (rows.length === 0) return null;
    return rows[0];
  },

  async saveGoal(r: GoalInput): Promise<void> {
    await db
      .insert(schema.goals)
      .values({
        id: r.id,
        userId: r.userId,
        title: r.title,
        description: r.description ?? null,
        category: r.category ?? 'personal',
        status: r.status ?? 'active',
        progress: r.progress ?? 0,
        targetDate: r.targetDate ?? null,
        completedAt: r.completedAt ?? null,
        emoji: r.emoji ?? '🌱',
        sortOrder: r.sortOrder ?? 0,
        imageUrl: r.imageUrl ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        syncStatus: r.syncStatus || 'synced',
        serverUpdatedAt: r.serverUpdatedAt,
      })
      .onConflictDoUpdate({
        target: schema.goals.id,
        set: {
          title: r.title,
          description: r.description ?? null,
          category: r.category ?? 'personal',
          status: r.status ?? 'active',
          progress: r.progress ?? 0,
          targetDate: r.targetDate ?? null,
          completedAt: r.completedAt ?? null,
          emoji: r.emoji ?? '🌱',
          sortOrder: r.sortOrder ?? 0,
          imageUrl: r.imageUrl ?? null,
          updatedAt: r.updatedAt,
          syncStatus: r.syncStatus || 'synced',
          serverUpdatedAt: r.serverUpdatedAt,
          deletedAt: r.deletedAt || null,
        },
      });
  },

  async softDeleteGoal(id: string, deletedAt: string): Promise<void> {
    await db
      .update(schema.goals)
      .set({
        deletedAt,
        syncStatus: 'pending_update',
      })
      .where(eq(schema.goals.id, id));
  },
};

// ==========================================
// Memories Repository
// ==========================================
export const memoryRepo = {
  async fetchMemories(userId: string, searchQuery?: string, page = 1, limit = 15): Promise<MemoryModel[]> {
    const conditions = [
      eq(schema.memories.userId, userId),
      isNull(schema.memories.deletedAt),
    ];

    if (searchQuery) {
      const searchOr = or(
        like(schema.memories.title, `%${searchQuery}%`),
        like(schema.memories.body, `%${searchQuery}%`)
      );
      if (searchOr) conditions.push(searchOr);
    }

    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(schema.memories)
      .where(and(...conditions))
      .orderBy(desc(schema.memories.memoryDate), desc(schema.memories.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      body: r.body,
      emoji: r.emoji,
      mood: r.mood,
      imageUrls: fromJSON(r.imageUrls),
      memoryDate: r.memoryDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
      deletedAt: r.deletedAt,
    }));
  },

  async fetchMemoryById(id: string): Promise<MemoryModel | null> {
    const rows = await db.select().from(schema.memories).where(eq(schema.memories.id, id));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      title: r.title,
      body: r.body,
      emoji: r.emoji,
      mood: r.mood,
      imageUrls: fromJSON(r.imageUrls),
      memoryDate: r.memoryDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
      deletedAt: r.deletedAt,
    };
  },

  async saveMemory(r: MemoryInput): Promise<void> {
    await db
      .insert(schema.memories)
      .values({
        id: r.id,
        userId: r.userId,
        title: r.title,
        body: r.body ?? null,
        emoji: r.emoji ?? '🌸',
        mood: r.mood ?? null,
        imageUrls: toJSON(r.imageUrls),
        memoryDate: r.memoryDate,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        syncStatus: r.syncStatus || 'synced',
        serverUpdatedAt: r.serverUpdatedAt,
      })
      .onConflictDoUpdate({
        target: schema.memories.id,
        set: {
          title: r.title,
          body: r.body ?? null,
          emoji: r.emoji ?? '🌸',
          mood: r.mood ?? null,
          imageUrls: toJSON(r.imageUrls),
          memoryDate: r.memoryDate,
          updatedAt: r.updatedAt,
          syncStatus: r.syncStatus || 'synced',
          serverUpdatedAt: r.serverUpdatedAt,
          deletedAt: r.deletedAt || null,
        },
      });
  },

  async softDeleteMemory(id: string, deletedAt: string): Promise<void> {
    await db
      .update(schema.memories)
      .set({
        deletedAt,
        syncStatus: 'pending_update',
      })
      .where(eq(schema.memories.id, id));
  },
};

// ==========================================
// Future Letters Repository
// ==========================================
export const letterRepo = {
  async fetchLetters(userId: string, page = 1, limit = 20): Promise<LetterModel[]> {
    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(schema.futureLetters)
      .where(and(eq(schema.futureLetters.userId, userId), isNull(schema.futureLetters.deletedAt)))
      .orderBy(asc(schema.futureLetters.deliverAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      subject: r.subject,
      deliverAt: r.deliverAt,
      isUnlocked: Date.now() >= new Date(r.deliverAt).getTime(),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isRead: fromInt(r.isRead),
      isFavorite: fromInt(r.isFavorite),
      isDraft: fromInt(r.isDraft),
      isArchived: fromInt(r.isArchived),
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
    }));
  },

  async fetchLetterById(id: string): Promise<LetterModelDetail | null> {
    const rows = await db.select().from(schema.futureLetters).where(eq(schema.futureLetters.id, id));
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.userId,
      subject: r.subject,
      body: r.body,
      deliverAt: r.deliverAt,
      imageUrls: fromJSON(r.imageUrls),
      isUnlocked: Date.now() >= new Date(r.deliverAt).getTime(),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isRead: fromInt(r.isRead),
      isFavorite: fromInt(r.isFavorite),
      isDraft: fromInt(r.isDraft),
      isArchived: fromInt(r.isArchived),
      syncStatus: r.syncStatus,
      serverUpdatedAt: r.serverUpdatedAt,
      deletedAt: r.deletedAt,
    };
  },

  async saveLetter(r: LetterInput): Promise<void> {
    await db
      .insert(schema.futureLetters)
      .values({
        id: r.id,
        userId: r.userId,
        subject: r.subject,
        body: r.body,
        deliverAt: r.deliverAt,
        imageUrls: toJSON(r.imageUrls),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt ?? r.createdAt,
        isRead: toInt(r.isRead) ?? 0,
        isFavorite: toInt(r.isFavorite) ?? 0,
        isDraft: toInt(r.isDraft) ?? 0,
        isArchived: toInt(r.isArchived) ?? 0,
        syncStatus: r.syncStatus || 'synced',
        serverUpdatedAt: r.serverUpdatedAt,
      })
      .onConflictDoUpdate({
        target: schema.futureLetters.id,
        set: {
          subject: r.subject,
          body: r.body,
          deliverAt: r.deliverAt,
          imageUrls: toJSON(r.imageUrls),
          updatedAt: r.updatedAt ?? new Date().toISOString(),
          isRead: toInt(r.isRead) ?? 0,
          isFavorite: toInt(r.isFavorite) ?? 0,
          isDraft: toInt(r.isDraft) ?? 0,
          isArchived: toInt(r.isArchived) ?? 0,
          syncStatus: r.syncStatus || 'synced',
          serverUpdatedAt: r.serverUpdatedAt,
          deletedAt: r.deletedAt || null,
        },
      });
  },

  async softDeleteLetter(id: string, deletedAt: string): Promise<void> {
    await db
      .update(schema.futureLetters)
      .set({
        deletedAt,
        syncStatus: 'pending_update',
      })
      .where(eq(schema.futureLetters.id, id));
  },
};
