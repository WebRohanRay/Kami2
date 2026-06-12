import type { Letter } from '@features/home/types';
import type { CoupleLetter } from '@features/couple/types';

export function getRelativePathFromSignedUrl(url: string, bucket: string): string {
  if (!url.includes(`${bucket}/`)) return url;
  const parts = url.split(`${bucket}/`);
  const pathWithQuery = parts[1];
  return pathWithQuery.split('?')[0];
}

export function checkUnlocked(l: Letter | CoupleLetter) {
  return Date.now() >= new Date(l.deliverAt).getTime();
}

export function formatTimestamp(isoString: string | null | undefined, timezone?: string): string | null {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (d.getFullYear() <= 1970) return 'Delivered instantly';
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone || 'UTC' }) + ' • ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: timezone || 'UTC' });
}

export function formatCountdown(deliverAtIso: string): string {
  const diffMs = new Date(deliverAtIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Unlocked';

  const totalSecs = Math.floor(diffMs / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const totalHours = Math.floor(totalMins / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  let days = totalDays;
  let months = 0;
  let years = 0;

  if (days >= 365) {
    years = Math.floor(days / 365);
    days = days % 365;
  }
  if (days >= 30) {
    months = Math.floor(days / 30);
    days = days % 30;
  }

  if (years > 0) {
    const yStr = `${years} Year${years > 1 ? 's' : ''}`;
    const mStr = months > 0 ? ` ${months} Month${months > 1 ? 's' : ''}` : '';
    return `Unlocks in ${yStr}${mStr}`;
  }
  if (months > 0) {
    const mStr = `${months} Month${months > 1 ? 's' : ''}`;
    const dStr = days > 0 ? ` ${days} Day${days > 1 ? 's' : ''}` : '';
    return `Unlocks in ${mStr}${dStr}`;
  }
  if (days > 0) {
    const dStr = `${days} Day${days > 1 ? 's' : ''}`;
    const hStr = hours > 0 ? ` ${hours} Hour${hours > 1 ? 's' : ''}` : '';
    const minStr = mins > 0 ? ` ${mins} Minute${mins > 1 ? 's' : ''}` : '';
    return `Unlocks in ${dStr}${hStr}${minStr}`;
  }
  if (hours > 0) {
    const hStr = `${hours} Hour${hours > 1 ? 's' : ''}`;
    const minStr = mins > 0 ? ` ${mins} Minute${mins > 1 ? 's' : ''}` : '';
    const sStr = secs > 0 ? ` ${secs} Second${secs > 1 ? 's' : ''}` : '';
    return `Unlocks in ${hStr}${minStr}${sStr}`;
  }
  if (mins > 0) {
    const minStr = `${mins} Minute${mins > 1 ? 's' : ''}`;
    const sStr = secs > 0 ? ` ${secs} Second${secs > 1 ? 's' : ''}` : '';
    return `Unlocks in ${minStr}${sStr}`;
  }
  return `Unlocks in ${secs} Second${secs !== 1 ? 's' : ''}`;
}
