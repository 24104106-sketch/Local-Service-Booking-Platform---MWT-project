import { describe, it, expect } from "vitest";
import { parseAmount, formatCurrency } from "../utils/currency";

describe("currency utility", () => {
  it("parses strings with Indian Rupee symbol correctly", () => {
    expect(parseAmount("₹899")).toBe(899);
    expect(parseAmount("₹1,499")).toBe(1499);
    expect(parseAmount("₹ 25,000.50")).toBe(25000.5);
  });

  it("parses strings with other currency symbols ($ € £) correctly", () => {
    expect(parseAmount("$120")).toBe(120);
    expect(parseAmount("€ 450.75")).toBe(450.75);
    expect(parseAmount("£1,250")).toBe(1250);
  });

  it("handles numbers and falsy inputs cleanly", () => {
    expect(parseAmount(500)).toBe(500);
    expect(parseAmount(0)).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount("")).toBe(0);
  });

  it("formats currencies with appropriate symbols", () => {
    expect(formatCurrency(899)).toBe("₹899");
    expect(formatCurrency(1499, "INR")).toBe("₹1,499");
    expect(formatCurrency(250, "USD")).toBe("$250");
    expect(formatCurrency(500, "EUR")).toBe("€500");
    expect(formatCurrency(350, "GBP")).toBe("£350");
  });
});
