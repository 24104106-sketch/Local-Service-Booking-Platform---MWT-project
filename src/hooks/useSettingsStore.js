import { useLocalStorage } from "./useLocalStorage";
import { useAuth } from "./useAuth";

/**
 * Custom hook — a namespaced settings store for one section of Settings
 * (e.g. "bookingPrefs", "workingHours", "platform"). Keyed by the logged-in
 * user's email so each account keeps its own settings, without needing a
 * dedicated Context/reducer for every single settings sub-section — most
 * of these are simple, low-frequency preference objects that don't need
 * to be shared across users the way bookings/notifications do.
 *
 * Usage:
 *   const [prefs, updatePrefs] = useSettingsStore("bookingPrefs", { preferredTime: "morning" });
 *   updatePrefs({ preferredTime: "evening" }); // merges into existing prefs
 */
export function useSettingsStore(namespace, defaults) {
  const { user } = useAuth();
  const key = `fixit_local_settings_${namespace}_${user?.email || "guest"}`;
  const [settings, setSettings] = useLocalStorage(key, defaults);

  const update = (updates) => setSettings((prev) => ({ ...prev, ...updates }));

  return [settings, update];
}
