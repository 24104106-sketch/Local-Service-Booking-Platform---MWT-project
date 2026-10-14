import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePhone,
  validateRegistrationForm,
  formatJoinedDate,
} from "../utils/validation";

describe("validation utility", () => {
  it("validates emails correctly", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("admin@fixit.com")).toBe(true);
    expect(validateEmail("invalid-email")).toBe(false);
    expect(validateEmail("")).toBe(false);
  });

  it("validates 10-digit phone numbers correctly", () => {
    expect(validatePhone("9876543210")).toBe(true);
    expect(validatePhone("8123456789")).toBe(true);
    expect(validatePhone("6123456789")).toBe(true);
    expect(validatePhone("12345")).toBe(false);
    expect(validatePhone("abcdefghij")).toBe(false);
  });

  it("validates registration forms correctly", () => {
    const validForm = {
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
      confirmPassword: "password123",
      phone: "9876543210",
    };
    expect(validateRegistrationForm(validForm)).toBe("");

    expect(
      validateRegistrationForm({ ...validForm, fullName: "" })
    ).toBe("Please fill in all required fields.");

    expect(
      validateRegistrationForm({ ...validForm, email: "invalid" })
    ).toBe("Please enter a valid email address.");

    expect(
      validateRegistrationForm({ ...validForm, phone: "123" })
    ).toBe("Please enter a valid 10-digit phone number.");

    expect(
      validateRegistrationForm({ ...validForm, password: "123", confirmPassword: "123" })
    ).toBe("Password must be at least 6 characters.");

    expect(
      validateRegistrationForm({ ...validForm, confirmPassword: "different" })
    ).toBe("Passwords do not match.");
  });

  it("formats joined dates accurately", () => {
    expect(formatJoinedDate(null)).toBe("—");
    expect(formatJoinedDate("2026-03-12")).toContain("2026");
  });
});
