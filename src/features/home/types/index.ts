// ─── Mood ────────────────────────────────────────────────────────────────────

export interface MoodOption {
  id:    string;
  emoji: string;
  label: string;
  color: string; // accent color for selected state
}

export interface MoodLog {
  id:         string;
  userId:     string;
  moodId:     string;
  moodEmoji:  string;
  moodLabel:  string;
  note:       string | null;
  loggedDate: string; // ISO date string YYYY-MM-DD
  createdAt:  string;
  updatedAt:  string;
}

export type CreateMoodLogInput = {
  moodId:    string;
  moodEmoji: string;
  moodLabel: string;
  note?:     string;
};

// ─── Journal ─────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id:        string;
  userId:    string;
  title:     string | null;
  body:      string;
  moodId:    string | null;
  tags:      string[];
  imageUrls?: string[];
  entryDate: string; // ISO date YYYY-MM-DD
  isPinned:  boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateJournalInput = {
  title?: string;
  body:   string;
  moodId?: string;
  tags?:  string[];
  imageUrls?: string[];
};

export type UpdateJournalInput = Partial<CreateJournalInput> & {
  isPinned?: boolean;
};

// ─── Goals ───────────────────────────────────────────────────────────────────

export type GoalCategory =
  | 'personal'
  | 'health'
  | 'career'
  | 'relationship'
  | 'learning'
  | 'creative'
  | 'other';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface Goal {
  id:          string;
  userId:      string;
  title:       string;
  description: string | null;
  category:    GoalCategory;
  status:      GoalStatus;
  progress:    number; // 0–100
  targetDate:  string | null;
  completedAt: string | null;
  emoji:       string;
  imageUrl?:   string | null;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
}

export type CreateGoalInput = {
  title:       string;
  description?: string;
  category:    GoalCategory;
  targetDate?: string;
  emoji?:      string;
  imageUrl?:   string | null;
};

export type UpdateGoalInput = Partial<{
  title:       string;
  description: string;
  category:    GoalCategory;
  status:      GoalStatus;
  progress:    number;
  targetDate:  string;
  emoji:       string;
  imageUrl:    string | null;
}>;

// ─── Prompts ─────────────────────────────────────────────────────────────────

export interface DailyPrompt {
  id:       string;
  content:  string;
  category: string;
}

export interface PromptResponse {
  id:           string;
  userId:       string;
  promptId:     string;
  response:     string;
  responseDate: string;
  createdAt:    string;
}

// ─── Streak ──────────────────────────────────────────────────────────────────

export interface Streak {
  userId:          string;
  currentStreak:   number;
  longestStreak:   number;
  lastCheckinDate: string | null;
  totalCheckins:   number;
}

// ─── Memories ────────────────────────────────────────────────────────────────

export interface Memory {
  id:         string;
  userId:     string;
  title:      string;
  body:       string;
  emoji:      string;
  mood:       string | null;
  imageUrls:  string[];
  memoryDate: string;
  createdAt:  string;
}

export type CreateMemoryInput = {
  title:      string;
  body?:      string;
  emoji:      string;
  mood?:      string | null;
  imageUrls?: string[];
};

export type UpdateMemoryInput = Partial<CreateMemoryInput>;

// ─── Letters ─────────────────────────────────────────────────────────────────

export interface Letter {
  id:           string;
  userId:       string;
  subject:      string;
  body?:        string;
  deliverAt:    string;
  isUnlocked:   boolean;
  imageUrls?:   string[];
  createdAt:    string;
}

export type CreateLetterInput = {
  subject:    string;
  body:       string;
  deliverAt:  string;
  imageUrls?: string[];
};

// ─── Result ──────────────────────────────────────────────────────────────────

export type Result<T> =
  | { success: true;  data: T }
  | { success: false; error: string };
