import { useState, useCallback } from 'react';

/**
 * Custom hook that behaves like useState, but persists the state value in localStorage.
 * Automatically synchronizes changes and restores state across page reloads.
 *
 * @template T
 * @param {string} key - Unique storage key (will be prefixed with komazi_state_)
 * @param {T | (() => T)} initialValue - Default value or initializer function
 * @returns {[T, (value: T | ((prev: T) => T)) => void]} - [state, setState]
 */
export function usePersistentState(key, initialValue) {
  const storageKey = `komazi_state_${key}`;

  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null && stored !== 'undefined') {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn(`[usePersistentState] Gagal membaca localStorage key "${storageKey}":`, err);
    }
    return typeof initialValue === 'function' ? initialValue() : initialValue;
  });

  const setPersistentState = useCallback(
    (valueOrFn) => {
      setState((prev) => {
        const next = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
        if (typeof window !== 'undefined') {
          try {
            if (next === undefined) {
              window.localStorage.removeItem(storageKey);
            } else {
              window.localStorage.setItem(storageKey, JSON.stringify(next));
            }
          } catch (err) {
            console.warn(`[usePersistentState] Gagal menyimpan ke localStorage key "${storageKey}":`, err);
          }
        }
        return next;
      });
    },
    [storageKey]
  );

  return [state, setPersistentState];
}

export default usePersistentState;
