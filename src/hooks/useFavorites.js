import { useCallback } from "react";
import { useSettingsStore } from "./useSettingsStore";
import { useToast } from "./useToast";

/**
 * Custom hook — the single entry point for favoriting providers/services.
 * Wraps the existing "favorites" settings-store namespace (already read by
 * the Favorites settings tab) with actual toggle actions, so a heart button
 * on Browse Services or a Provider Profile page can add/remove instantly
 * and see it reflected in Settings > Favorites without any extra wiring.
 *
 * Usage:
 *   const { isFavoriteProvider, toggleFavoriteProvider } = useFavorites();
 *   <button onClick={() => toggleFavoriteProvider(service.provider)}>
 *     {isFavoriteProvider(service.provider) ? "♥" : "♡"}
 *   </button>
 */
export function useFavorites() {
  const [favorites, updateFavorites] = useSettingsStore("favorites", { providers: [], services: [] });
  const { showToast } = useToast();

  const isFavoriteProvider = useCallback((name) => favorites.providers.includes(name), [favorites.providers]);
  const isFavoriteService = useCallback((name) => favorites.services.includes(name), [favorites.services]);

  const toggleFavoriteProvider = useCallback(
    (name) => {
      const already = favorites.providers.includes(name);
      updateFavorites({
        providers: already ? favorites.providers.filter((p) => p !== name) : [...favorites.providers, name],
      });
      showToast(already ? `Removed ${name} from favorites` : `Added ${name} to favorites`, already ? "info" : "success");
    },
    [favorites.providers, updateFavorites, showToast]
  );

  const toggleFavoriteService = useCallback(
    (name) => {
      const already = favorites.services.includes(name);
      updateFavorites({
        services: already ? favorites.services.filter((s) => s !== name) : [...favorites.services, name],
      });
      showToast(already ? `Removed ${name} from favorites` : `Added ${name} to favorites`, already ? "info" : "success");
    },
    [favorites.services, updateFavorites, showToast]
  );

  return { favorites, isFavoriteProvider, isFavoriteService, toggleFavoriteProvider, toggleFavoriteService };
}
