import { useState, useCallback } from 'react';

type Rules<T> = Partial<Record<keyof T, (v: string) => string | undefined>>;
type Errors<T> = Partial<Record<keyof T, string>>;

export function useForm<T extends Record<string, string>>(initial: T, rules?: Rules<T>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const set = useCallback((field: keyof T, value: string) => {
    setValues(v => ({ ...v, [field]: value }));
    if (touched[field] && rules?.[field]) {
      const err = rules[field]!(value);
      setErrors(e => ({ ...e, [field]: err }));
    }
  }, [touched, rules]);

  const touch = useCallback((field: keyof T) => {
    setTouched(t => ({ ...t, [field]: true }));
    if (rules?.[field]) {
      const err = rules[field]!(values[field]);
      setErrors(e => ({ ...e, [field]: err }));
    }
  }, [values, rules]);

  const validate = useCallback((): boolean => {
    if (!rules) return true;
    const next: Errors<T> = {};
    let valid = true;
    for (const field of Object.keys(rules) as (keyof T)[]) {
      const err = rules[field]!(values[field]);
      if (err) { next[field] = err; valid = false; }
    }
    setErrors(next);
    setTouched(Object.fromEntries(Object.keys(rules).map(k => [k, true])) as any);
    return valid;
  }, [values, rules]);

  const reset = useCallback(() => {
    setValues(initial); setErrors({}); setTouched({});
  }, [initial]);

  return { values, errors, set, touch, validate, reset };
}
