// ─── Date ─────────────────────────────────────────────────────────────────────
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
export function greetingByTime(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── String ───────────────────────────────────────────────────────────────────
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function truncate(s: string, max = 80): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
export function initial(name: string | undefined, fallback = 'K'): string {
  return (name?.trim().slice(0, 1) ?? fallback).toUpperCase();
}
export function displayName(nickname?: string, email?: string): string {
  if (nickname?.trim()) return nickname.trim();
  if (email?.includes('@')) return email.split('@')[0];
  return 'there';
}

// ─── Number ───────────────────────────────────────────────────────────────────
export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
