import { useState, useMemo, useDebugValue } from "react";

/**
 * Custom hook — slices `items` into pages of `pageSize`, clamping the
 * current page automatically if the underlying list shrinks (e.g. after
 * a filter is applied) so you never get stuck on an empty page.
 *
 * Usage:
 *   const { page, totalPages, paginated, nextPage, prevPage, hasNext, hasPrev } =
 *     usePagination(bookings, 5);
 */
export function usePagination(items, pageSize = 5) {
  const [page, setPage] = useState(1);
  const list = items || [];

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginated = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    [list, safePage, pageSize]
  );

  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));
  const nextPage = () => goToPage(safePage + 1);
  const prevPage = () => goToPage(safePage - 1);

  // useDebugValue — shows "Page 2 of 5 (23 items)" next to this hook in
  // React DevTools instead of just raw state, useful when several pages
  // use usePagination at once and you're trying to tell them apart.
  useDebugValue(`Page ${safePage} of ${totalPages} (${list.length} items)`);

  return {
    page: safePage,
    totalPages,
    paginated,
    goToPage,
    nextPage,
    prevPage,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
