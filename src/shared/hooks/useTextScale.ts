import { useAuthStore } from '@features/auth/store';

export function useTextScale() {
  const textSizePref = useAuthStore((s) => s.user?.textSize ?? 'medium');

  let multiplier = 0.96;
  if (textSizePref === 'small') {
    multiplier = 0.90;
  } else if (textSizePref === 'large') {
    multiplier = 1.05;
  }

  const scaleSize = (size: number) => Math.round(size * multiplier);

  return {
    multiplier,
    textSizePref,
    scaleSize,
  };
}
