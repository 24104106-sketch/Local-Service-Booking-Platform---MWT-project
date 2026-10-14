import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "../usePagination";

const items = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));

describe("usePagination", () => {
  it("slices the first page by default", () => {
    const { result } = renderHook(() => usePagination(items, 5));
    expect(result.current.paginated).toHaveLength(5);
    expect(result.current.paginated[0].id).toBe(1);
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(3);
  });

  it("advances to the next page correctly", () => {
    const { result } = renderHook(() => usePagination(items, 5));
    act(() => result.current.nextPage());
    expect(result.current.page).toBe(2);
    expect(result.current.paginated[0].id).toBe(6);
  });

  it("does not go past the last page", () => {
    const { result } = renderHook(() => usePagination(items, 5));
    act(() => result.current.goToPage(99));
    expect(result.current.page).toBe(3);
    expect(result.current.hasNext).toBe(false);
  });

  it("does not go below page 1", () => {
    const { result } = renderHook(() => usePagination(items, 5));
    act(() => result.current.prevPage());
    expect(result.current.page).toBe(1);
    expect(result.current.hasPrev).toBe(false);
  });

  it("clamps the current page automatically when the list shrinks (e.g. after filtering)", () => {
    const { result, rerender } = renderHook(({ list }) => usePagination(list, 5), {
      initialProps: { list: items },
    });

    act(() => result.current.goToPage(3));
    expect(result.current.page).toBe(3);

    // Simulate a filter reducing the list to 2 items — should no longer be stuck on page 3
    rerender({ list: items.slice(0, 2) });
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(1);
  });

  it("handles an empty list without crashing", () => {
    const { result } = renderHook(() => usePagination([], 5));
    expect(result.current.paginated).toEqual([]);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.hasNext).toBe(false);
  });
});
