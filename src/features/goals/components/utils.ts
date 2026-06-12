import type { Goal, GoalCategory } from '@features/home/types';

export const CATEGORIES: { id: GoalCategory; emoji: string; label: string }[] = [
  { id: 'personal', emoji: '🌱', label: 'Personal' },
  { id: 'health', emoji: '💪', label: 'Health' },
  { id: 'career', emoji: '🚀', label: 'Career' },
  { id: 'learning', emoji: '📚', label: 'Learning' },
  { id: 'creative', emoji: '🎨', label: 'Creative' },
  { id: 'relationship', emoji: '💛', label: 'Relationship' },
  { id: 'other', emoji: '⭐', label: 'Other' },
];

export const EMOJIS = ['🌱', '🎯', '💪', '📚', '🚀', '🎨', '💛', '⭐', '🏃', '✍️', '🧘', '🌟', '🎵', '🌍', '🏋️', '💡'];

export const STATUS_LABELS: Record<Goal['status'], string> = {
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
  abandoned: 'Abandoned',
};

export function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(diff / 86400000);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'Due today';
  return `${d}d left`;
}
