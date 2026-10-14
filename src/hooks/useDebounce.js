import { useState, useEffect } from "react";

/**
 * Custom hook — returns a debounced copy of `value` that only updates
 * `delay` ms after the value stops changing. Used to avoid re-filtering
 * a list (or firing a search request) on every single keystroke.
 *
 * Usage:
 *   const debouncedQuery = useDebounce(query, 300);
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    // if `value` changes again before `delay` elapses, this cleanup cancels
    // the pending update — that's the entire debounce mechanism.
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
