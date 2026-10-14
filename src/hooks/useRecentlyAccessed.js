import { useState, useEffect, useCallback } from "react";
import apiClient from "../api/apiClient";
import { useAuth } from "./useAuth";

/**
 * Custom hook for the persistent Recently Accessed / Viewed feature.
 * Authenticated users persist accessed services and providers in MySQL.
 */
export function useRecentlyAccessed(limit = 8) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/recently-accessed", { limit });
      if (res && res.success) {
        setItems(Array.isArray(res.data) ? res.data : []);
      } else {
        setItems([]);
      }
    } catch (err) {
      setError(err.message || "Failed to load recently accessed items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, limit]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const recordAccess = useCallback(
    async (itemType, itemId, metadata = {}) => {
      if (!isAuthenticated || !user || !itemId) return;

      try {
        await apiClient.post("/recently-accessed", {
          itemType,
          itemId: Number(itemId),
          metadata,
        });
        // Silent refresh in background
        fetchItems();
      } catch (err) {
        // Log non-blocking error
        console.warn("[RecentlyAccessed] Failed to record view:", err.message);
      }
    },
    [isAuthenticated, user, fetchItems]
  );

  const clearHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await apiClient.delete("/recently-accessed");
      setItems([]);
    } catch (err) {
      console.error("[RecentlyAccessed] Failed to clear history:", err.message);
    }
  }, [isAuthenticated]);

  return {
    items,
    loading,
    error,
    refresh: fetchItems,
    recordAccess,
    clearHistory,
  };
}
