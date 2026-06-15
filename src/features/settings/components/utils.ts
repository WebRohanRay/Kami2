export const THEMES = [
  // Light Classics
  { id: 'blush', label: 'Blush Pink', emoji: '🌸' },
  { id: 'cherry_blossom', label: 'Cherry Blossom', emoji: '🌺' },
  { id: 'petal', label: 'Soft Petal', emoji: '🩷' },
  { id: 'rosewood', label: 'Rosewood', emoji: '🌹' },
  { id: 'crimson', label: 'Crimson Rose', emoji: '❤️‍🔥' },
  { id: 'coral', label: 'Coral Peach', emoji: '🍑' },
  { id: 'lavender', label: 'Lavender Mist', emoji: '🪻' },
  { id: 'mocha', label: 'Café Mocha', emoji: '☕' },
  { id: 'honey', label: 'Honey Gold', emoji: '🍯' },
  { id: 'marigold', label: 'Marigold Yellow', emoji: '🌼' },
  { id: 'champagne', label: 'Champagne', emoji: '🥂' },
  { id: 'sage', label: 'Sage Green', emoji: '🌿' },
  { id: 'emerald', label: 'Emerald Forest', emoji: '🌲' },
  { id: 'ocean', label: 'Ocean Breeze', emoji: '🌊' },
  { id: 'indigo', label: 'Deep Indigo', emoji: '💜' },
  { id: 'slate', label: 'Slate Gray', emoji: '⛰️' },
  { id: 'frost', label: 'Nordic Frost', emoji: '❄️' },
  // Dark & Moody
  { id: 'midnight', label: 'Midnight Cyber', emoji: '🌌' },
  { id: 'twilight', label: 'Twilight Haze', emoji: '🌆' },
  { id: 'aurora', label: 'Northern Aurora', emoji: '🌠' },
  { id: 'stargazer', label: 'Stargazer', emoji: '🌃' },
  { id: 'synthwave', label: 'Synthwave Sunset', emoji: '🌇' },
  { id: 'vampire', label: 'Gothic Crimson', emoji: '🦇' },
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
