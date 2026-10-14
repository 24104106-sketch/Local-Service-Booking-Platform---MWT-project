import { describe, it, expect } from "vitest";
import { chatReducer } from "../ChatContext";

const msg = (overrides) => ({
  id: "M1",
  bookingId: "BK1001",
  sender: "customer",
  senderName: "Ananya Rao",
  text: "Hello",
  read: false,
  timestamp: "2026-08-01T10:00:00.000Z",
  ...overrides,
});

describe("chatReducer", () => {
  it("SET replaces the entire message list (hydration)", () => {
    const result = chatReducer([], { type: "SET", payload: [msg()] });
    expect(result).toHaveLength(1);
  });

  it("SEND appends a new message without touching existing ones", () => {
    const state = [msg({ id: "M1" })];
    const result = chatReducer(state, { type: "SEND", payload: msg({ id: "M2", text: "Second message" }) });
    expect(result).toHaveLength(2);
    expect(result[1].text).toBe("Second message");
  });

  it("MARK_THREAD_READ flips only the other party's unread messages for that booking", () => {
    const state = [
      msg({ id: "M1", sender: "customer", read: false }), // should become read (provider is marking it)
      msg({ id: "M2", sender: "provider", read: false }), // sent by the reader themself — must stay untouched
      msg({ id: "M3", sender: "customer", read: true }), // already read — should stay read
      msg({ id: "M4", sender: "customer", bookingId: "BK9999", read: false }), // different booking — must stay untouched
    ];
    const result = chatReducer(state, { type: "MARK_THREAD_READ", bookingId: "BK1001", myRole: "provider" });

    expect(result.find((m) => m.id === "M1").read).toBe(true);
    expect(result.find((m) => m.id === "M2").read).toBe(false);
    expect(result.find((m) => m.id === "M3").read).toBe(true);
    expect(result.find((m) => m.id === "M4").read).toBe(false);
  });

  it("unknown action types are a no-op", () => {
    const state = [msg()];
    const result = chatReducer(state, { type: "NOT_A_REAL_ACTION" });
    expect(result).toBe(state);
  });
});
