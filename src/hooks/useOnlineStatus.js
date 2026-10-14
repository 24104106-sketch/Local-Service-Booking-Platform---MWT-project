import { useState, useEffect, useDebugValue } from "react";

/**
 * Custom hook — tracks the browser's connectivity via the native
 * online/offline events. Useful for warning the user before they try
 * to book a service or make a payment with no connection.
 *
 * Usage:
 *   const isOnline = useOnlineStatus();
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // useDebugValue — shows "🟢 Online" / "🔴 Offline" next to this hook in
  // React DevTools instead of a bare `true`/`false`.
  useDebugValue(isOnline ? "🟢 Online" : "🔴 Offline");

  return isOnline;
}
