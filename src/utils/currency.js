/**
 * Currency Utility: robust multi-currency parsing and formatting.
 */

const CURRENCY_SYMBOLS = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/**
 * Parses any currency string or number to a clean integer/float number.
 * Handles "₹899", "$1,299", "€ 450.50", "499", etc.
 *
 * @param {string|number} amountStr
 * @returns {number}
 */
export function parseAmount(amountStr) {
  if (typeof amountStr === "number") return isNaN(amountStr) ? 0 : amountStr;
  if (!amountStr) return 0;
  // Strip out any currency symbols and non-numeric chars except digits and decimals
  const cleaned = String(amountStr).replace(/[^0-9.-]+/g, "");
  return Number(cleaned) || 0;
}

/**
 * Formats a numeric amount with the selected currency symbol.
 *
 * @param {number|string} amount
 * @param {string} [currency="INR"] - "INR" | "USD" | "EUR" | "GBP" or symbol
 * @returns {string} e.g. "₹1,299"
 */
export function formatCurrency(amount, currency = "INR") {
  const num = parseAmount(amount);
  const symbol = CURRENCY_SYMBOLS[currency] || (currency.length === 1 ? currency : "₹");
  return `${symbol}${num.toLocaleString("en-IN")}`;
}
