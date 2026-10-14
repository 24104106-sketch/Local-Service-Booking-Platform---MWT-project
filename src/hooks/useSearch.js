import { useState, useMemo } from "react";
import { useDebounce } from "./useDebounce";

/**
 * Custom hook — text search + optional category filter over an array,
 * with the search term debounced so filtering doesn't run on every keystroke.
 * Demonstrates one custom hook (useSearch) composing another (useDebounce).
 *
 * Usage:
 *   const { query, setQuery, filterValue, setFilterValue, filterOptions, results, isSearching } =
 *     useSearch(services, { keys: ["name", "provider"], filterKey: "category" });
 */
export function useSearch(items, { keys = [], filterKey = null, initialFilterValue = "All", initialQuery = "", debounceMs = 300 } = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [filterValue, setFilterValue] = useState(initialFilterValue);
  const debouncedQuery = useDebounce(query, debounceMs);

  const filterOptions = useMemo(() => {
    if (!filterKey) return [];
    return [initialFilterValue, ...new Set((items || []).map((item) => item[filterKey]))];
  }, [items, filterKey, initialFilterValue]);

  const results = useMemo(() => {
    const list = items || [];
    const q = debouncedQuery.trim().toLowerCase();
    return list.filter((item) => {
      const matchesQuery = !q || keys.some((key) => String(item[key] ?? "").toLowerCase().includes(q));
      const matchesFilter = !filterKey || filterValue === initialFilterValue || item[filterKey] === filterValue;
      return matchesQuery && matchesFilter;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, debouncedQuery, filterKey, filterValue, initialFilterValue]);

  return {
    query,
    setQuery,
    filterValue,
    setFilterValue,
    filterOptions,
    results,
    isSearching: query !== debouncedQuery, // lets the UI show a subtle "Searching..." hint
  };
}
