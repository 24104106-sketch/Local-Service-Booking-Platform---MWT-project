import { useState, useMemo } from "react";

/**
 * Custom hook — sorts `items` by `sortKey`/`direction`, both controllable.
 * Handles numeric and string fields transparently.
 *
 * Usage:
 *   const { sorted, sortKey, direction, setSortKey, setDirection } = useSort(services);
 *   setSortKey("price"); setDirection("asc");
 */
export function useSort(items, initialKey = null, initialDirection = "asc") {
  const [sortKey, setSortKey] = useState(initialKey);
  const [direction, setDirection] = useState(initialDirection);

  const sorted = useMemo(() => {
    const list = items || [];
    if (!sortKey) return list;

    return [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      return direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [items, sortKey, direction]);

  return { sorted, sortKey, setSortKey, direction, setDirection };
}
