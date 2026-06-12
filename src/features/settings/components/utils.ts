export const THEMES = [
  { id: 'blush', label: 'Blush Pink', emoji: '🌸' },
  { id: 'indigo', label: 'Midnight Indigo', emoji: '🌙' },
  { id: 'slate', label: 'Slate Gray', emoji: '⛰️' },
  { id: 'sage', label: 'Sage Green', emoji: '🌿' },
  { id: 'honey', label: 'Honey Gold', emoji: '🍯' },
  { id: 'lavender', label: 'Lavender Mist', emoji: '🪻' },
  { id: 'coral', label: 'Coral Peach', emoji: '🍑' },
  { id: 'ocean', label: 'Ocean Breeze', emoji: '🌊' },
  { id: 'crimson', label: 'Crimson Rose', emoji: '🌹' },
] as const;

export const TEXT_SIZES = [
  { id: 'small', label: 'Small', emoji: '▫️' },
  { id: 'medium', label: 'Medium', emoji: '◽' },
  { id: 'large', label: 'Large', emoji: '◻️' },
] as const;

export const TIMEZONES = [
  { id: 'Asia/Kolkata', label: 'India (UTC+5:30)', emoji: '🇮🇳' },
  { id: 'Asia/Manila', label: 'Philippines (UTC+8:00)', emoji: '🇵🇭' },
  { id: 'Asia/Jakarta', label: 'Indonesia (UTC+7:00)', emoji: '🇮🇩' },
  { id: 'Asia/Singapore', label: 'Singapore (UTC+8:00)', emoji: '🇸🇬' },
  { id: 'Europe/London', label: 'London (UTC+1:00)', emoji: '🇬🇧' },
  { id: 'America/New_York', label: 'New York (UTC-4:00)', emoji: '🇺🇸' },
  { id: 'America/Los_Angeles', label: 'Los Angeles (UTC-7:00)', emoji: '🇺🇸' },
  { id: 'UTC', label: 'Universal Coordinated Time (UTC)', emoji: '🌐' },
] as const;

export function getDaysRemaining(deleteAtStr: string | null): number {
  if (!deleteAtStr) return 7;
  const diffTime = new Date(deleteAtStr).getTime() - Date.now();
  const diffDays = Math.ceil(diffTime / 86400000);
  return Math.max(0, diffDays);
}

export function initialsFor(name?: string, email?: string) {
  return (name?.trim() || email?.trim() || 'K').slice(0, 1).toUpperCase();
}
