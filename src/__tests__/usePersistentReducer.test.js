import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePersistentReducer } from "../hooks/usePersistentReducer";

describe("usePersistentReducer", () => {
  const STORAGE_KEY = "test_persistent_key";

  beforeEach(() => {
    localStorage.clear();
  });

  function counterReducer(state, action) {
    switch (action.type) {
      case "SET":
        return action.payload;
      case "INCREMENT":
        return { count: state.count + 1 };
      case "DECREMENT":
        return { count: state.count - 1 };
      default:
        return state;
    }
  }

  it("initializes with initialData when localStorage is empty", () => {
    const { result } = renderHook(() =>
      usePersistentReducer(counterReducer, { count: 0 }, STORAGE_KEY)
    );

    const [state, , hydrated] = result.current;
    expect(state).toEqual({ count: 0 });
    expect(hydrated).toBe(true);
  });

  it("updates state and persists to localStorage on dispatch", () => {
    const { result } = renderHook(() =>
      usePersistentReducer(counterReducer, { count: 0 }, STORAGE_KEY)
    );

    act(() => {
      const [, dispatch] = result.current;
      dispatch({ type: "INCREMENT" });
    });

    const [state] = result.current;
    expect(state).toEqual({ count: 1 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ count: 1 });
  });

  it("hydrates saved state from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 42 }));

    const { result } = renderHook(() =>
      usePersistentReducer(counterReducer, { count: 0 }, STORAGE_KEY)
    );

    const [state, , hydrated] = result.current;
    expect(state).toEqual({ count: 42 });
    expect(hydrated).toBe(true);
  });
});
