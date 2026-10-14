import { describe, it, expect } from "vitest";
import { bookingsReducer } from "../BookingContext";

const sampleBooking = {
  id: "BK1001",
  customer: "Ananya Rao",
  provider: "Kumar Cooling Co.",
  service: "AC Repair",
  status: "Pending",
};

describe("bookingsReducer", () => {
  it("SET replaces the entire list (used for hydration from storage/API)", () => {
    const result = bookingsReducer([], { type: "SET", payload: [sampleBooking] });
    expect(result).toEqual([sampleBooking]);
  });

  it("CREATE prepends a new booking so the newest is always first", () => {
    const existing = [{ ...sampleBooking, id: "BK1000" }];
    const result = bookingsReducer(existing, { type: "CREATE", payload: sampleBooking });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("BK1001");
    expect(result[1].id).toBe("BK1000");
  });

  it("UPDATE_STATUS only touches the matching booking, leaving others untouched", () => {
    const other = { ...sampleBooking, id: "BK9999", status: "Completed" };
    const state = [sampleBooking, other];
    const result = bookingsReducer(state, { type: "UPDATE_STATUS", id: "BK1001", changes: { status: "Confirmed" } });
    expect(result.find((b) => b.id === "BK1001").status).toBe("Confirmed");
    expect(result.find((b) => b.id === "BK9999")).toEqual(other);
  });

  it("UPDATE_STATUS merges changes rather than replacing the whole booking", () => {
    const state = [sampleBooking];
    const result = bookingsReducer(state, {
      type: "UPDATE_STATUS",
      id: "BK1001",
      changes: { status: "Completed", paymentStatus: "Paid" },
    });
    expect(result[0]).toMatchObject({
      id: "BK1001",
      customer: "Ananya Rao", // preserved, not part of `changes`
      status: "Completed",
      paymentStatus: "Paid",
    });
  });

  it("walks a booking through the full lifecycle, including the mid-stage statuses", () => {
    // This is the exact gap identified in the Phase 0 review: the status
    // machine used to jump straight from Confirmed to Completed. These
    // three intermediate stages (On The Way / Arrived / Service Started)
    // are what Phase 3 added — this test locks that fix in place.
    const lifecycle = ["Pending", "Confirmed", "On The Way", "Arrived", "Service Started", "Completed"];
    let state = [sampleBooking];

    for (let i = 1; i < lifecycle.length; i++) {
      state = bookingsReducer(state, { type: "UPDATE_STATUS", id: "BK1001", changes: { status: lifecycle[i] } });
      expect(state[0].status).toBe(lifecycle[i]);
    }
    expect(state[0].status).toBe("Completed");
  });

  it("unknown action types are a no-op", () => {
    const state = [sampleBooking];
    const result = bookingsReducer(state, { type: "NOT_A_REAL_ACTION" });
    expect(result).toBe(state);
  });
});
