import { useState, useEffect } from "react";

/**
 * Custom hook — behaves exactly like useState, but automatically
 * reads/writes the value to localStorage under `key`.
 * This is a "custom hook": a plain function that starts with `use`
 * and internally calls other hooks (useState + useEffect here).
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — fail silently
    }
  }, [key, value]);

  return [value, setValue];
}
