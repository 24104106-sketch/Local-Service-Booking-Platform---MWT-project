// Every piece of "backend" state in this mock app lives in localStorage
// under a fixit_local_ prefixed key (bookings, reviews, complaints,
// notifications, wallets, registered users, session, theme, language...).
// That's great for persistence between visits, but it also means old data
// created before a bug fix — like a booking saved before createBookingRequest
// correctly included the customer field — stays broken forever, since the
// app only re-seeds fresh demo data when localStorage is empty. This clears
// everything and reloads straight to the login screen for a clean slate.
export function resetDemoData() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith("fixit_local_"))
    .forEach((key) => localStorage.removeItem(key));
  window.location.href = "/login";
}
