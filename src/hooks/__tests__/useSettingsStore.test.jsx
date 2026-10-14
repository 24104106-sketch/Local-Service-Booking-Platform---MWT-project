import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettingsStore } from "../useSettingsStore";
import { UserContext } from "../../context/UserContext";

function wrapperFor(email) {
  return function Wrapper({ children }) {
    return (
      <UserContext.Provider value={{ user: { email, name: "Test User" }, login: () => {}, logout: () => {} }}>
        {children}
      </UserContext.Provider>
    );
  };
}

describe("useSettingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the given defaults when nothing is stored yet", () => {
    const { result } = renderHook(() => useSettingsStore("notifications", { promotions: false }), {
      wrapper: wrapperFor("a@example.com"),
    });
    expect(result.current[0]).toEqual({ promotions: false });
  });

  it("merges partial updates instead of replacing the whole object", () => {
    const { result } = renderHook(() => useSettingsStore("notifications", { a: true, b: false }), {
      wrapper: wrapperFor("a@example.com"),
    });

    act(() => result.current[1]({ b: true }));

    expect(result.current[0]).toEqual({ a: true, b: true });
  });

  it("persists updates to localStorage under a namespaced, per-user key", () => {
    const { result } = renderHook(() => useSettingsStore("payout", { method: "bank" }), {
      wrapper: wrapperFor("provider@example.com"),
    });

    act(() => result.current[1]({ method: "upi" }));

    const raw = localStorage.getItem("fixit_local_settings_payout_provider@example.com");
    expect(JSON.parse(raw)).toEqual({ method: "upi" });
  });

  it("keeps different users' settings for the same namespace separate", () => {
    const { result: userA } = renderHook(() => useSettingsStore("privacy", { shareLocation: true }), {
      wrapper: wrapperFor("userA@example.com"),
    });
    act(() => userA.current[1]({ shareLocation: false }));

    const { result: userB } = renderHook(() => useSettingsStore("privacy", { shareLocation: true }), {
      wrapper: wrapperFor("userB@example.com"),
    });

    expect(userB.current[0]).toEqual({ shareLocation: true });
  });
});
