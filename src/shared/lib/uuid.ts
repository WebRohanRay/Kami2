/**
 * Generates a cryptographically secure UUID v4.
 * Uses native global crypto.randomUUID() if available.
 * Falls back to crypto.getRandomValues() or a pseudo-random generator if not.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const rnds = new Uint8Array(16);
      crypto.getRandomValues(rnds);
      rnds[6] = (rnds[6] & 0x0f) | 0x40;
      rnds[8] = (rnds[8] & 0x3f) | 0x80;

      const buffer: string[] = [];
      for (let i = 0; i < 16; i++) {
        if (i === 4 || i === 6 || i === 8 || i === 10) {
          buffer.push('-');
        }
        buffer.push(rnds[i].toString(16).padStart(2, '0'));
      }
      return buffer.join('');
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
