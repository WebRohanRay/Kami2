import { useState, useCallback } from 'react';
export function useToggle(initial = false): [boolean, () => void] {
  const [v, set] = useState(initial);
  return [v, useCallback(() => set(x => !x), [])];
}
