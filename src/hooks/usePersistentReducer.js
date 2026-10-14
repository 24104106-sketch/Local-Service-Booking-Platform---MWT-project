import { useReducer, useEffect, useState } from "react";

/**
 * Custom hook that combines useReducer with automatic localStorage hydration and persistence.
 *
 * @param {Function} reducer - State reducer function (state, action) => newState
 * @param {any} initialData - Default initial state if nothing in storage/initial fetch
 * @param {string} storageKey - localStorage key to persist state under
 * @param {Function} [fetchInitial] - Optional async function that returns seed data if localStorage is empty
 * @returns {[any, Function, boolean]} [state, dispatch, isHydrated]
 */
export function usePersistentReducer(reducer, initialData, storageKey, fetchInitial = null) {
  const [state, dispatch] = useReducer(reducer, initialData);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate on mount from localStorage or fallback fetchInitial
  useEffect(() => {
    let isMounted = true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        dispatch({ type: "SET", payload: JSON.parse(saved) });
        setHydrated(true);
        return;
      }
    } catch {
      // JSON parse or storage read failed - fallback to seed
    }

    if (typeof fetchInitial === "function") {
      Promise.resolve(fetchInitial())
        .then((data) => {
          if (isMounted) {
            dispatch({ type: "SET", payload: data ?? initialData });
            setHydrated(true);
          }
        })
        .catch(() => {
          if (isMounted) {
            dispatch({ type: "SET", payload: initialData });
            setHydrated(true);
          }
        });
    } else {
      dispatch({ type: "SET", payload: initialData });
      setHydrated(true);
    }

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  // Persist state changes back to localStorage once hydrated
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Storage full or unavailable - fail silently
    }
  }, [state, hydrated, storageKey]);

  return [state, dispatch, hydrated];
}
