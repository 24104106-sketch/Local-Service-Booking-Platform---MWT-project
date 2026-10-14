/**
 * Centralized Validation & Formatting Helpers
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[6-9]\d{9}$/; // Standard 10-digit mobile starting with 6-9

/**
 * Validates a 10-digit phone number.
 * @param {string} phone
 * @returns {boolean}
 */
export function validatePhone(phone) {
  if (!phone) return true; // Optional if empty, unless marked required by caller
  return PHONE_PATTERN.test(String(phone).trim());
}

/**
 * Validates an email address format.
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email) return false;
  return EMAIL_PATTERN.test(String(email).trim());
}

/**
 * Validates user registration fields.
 * @param {object} form
 * @returns {string} Error message, or empty string if valid.
 */
export function validateRegistrationForm(form) {
  if (!form.fullName?.trim() || !form.email?.trim() || !form.password) {
    return "Please fill in all required fields.";
  }
  if (!validateEmail(form.email)) {
    return "Please enter a valid email address.";
  }
  if (form.phone?.trim() && !validatePhone(form.phone)) {
    return "Please enter a valid 10-digit phone number.";
  }
  if (form.password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  if (form.password !== form.confirmPassword) {
    return "Passwords do not match.";
  }
  return "";
}

/**
 * Standard formatted joined date.
 * @param {string|Date} dateStr
 * @returns {string} e.g. "12 Mar 2026"
 */
export function formatJoinedDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
