import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSort } from "../useSort";

const services = [
  { name: "AC Repair", price: 899, rating: 4 },
  { name: "Home Cleaning", price: 1299, rating: 5 },
  { name: "Plumbing Fix", price: 499, rating: 4 },
];

describe("useSort", () => {
  it("returns the original order when no sortKey is set", () => {
    const { result } = renderHook(() => useSort(services));
    expect(result.current.sorted.map((s) => s.name)).toEqual([
      "AC Repair",
      "Home Cleaning",
      "Plumbing Fix",
    ]);
  });

  it("sorts numeric fields ascending", () => {
    const { result } = renderHook(() => useSort(services, "price", "asc"));
    expect(result.current.sorted.map((s) => s.price)).toEqual([499, 899, 1299]);
  });

  it("sorts numeric fields descending", () => {
    const { result } = renderHook(() => useSort(services, "price", "desc"));
    expect(result.current.sorted.map((s) => s.price)).toEqual([1299, 899, 499]);
  });

  it("updates when setSortKey/setDirection are called", () => {
    const { result } = renderHook(() => useSort(services));
    act(() => {
      result.current.setSortKey("rating");
      result.current.setDirection("desc");
    });
    expect(result.current.sorted[0].rating).toBe(5);
  });

  it("sorts string fields alphabetically", () => {
    const { result } = renderHook(() => useSort(services, "name", "asc"));
    expect(result.current.sorted.map((s) => s.name)).toEqual([
      "AC Repair",
      "Home Cleaning",
      "Plumbing Fix",
    ]);
  });

  it("does not mutate the original array", () => {
    const original = [...services];
    renderHook(() => useSort(services, "price", "desc"));
    expect(services).toEqual(original);
  });
});
