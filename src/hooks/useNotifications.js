import { useContext, useCallback } from "react";
import { NotificationContext } from "../context/NotificationContext";
import { useAuth } from "./useAuth";

import apiClient from "../api/apiClient";

let notifSeq = 100;

/**
 * Custom hook — the single entry point for notifications. Scopes the shared
 * list down to the current user (matched by ID or name) and exposes both read
 * actions and a `notify()` creator.
 *
 * Usage:
 *   const { notifications, unreadCount, markAsRead, markAllRead, notify } = useNotifications();
 */
export function useNotifications() {
  const { notifications, dispatch, hydrated } = useContext(NotificationContext);
  const { user } = useAuth();

  const mine = notifications.filter((n) => {
    if (!user) return false;
    const uid = user.id != null ? String(user.id) : (user._id != null ? String(user._id) : null);
    if (uid && (String(n.recipient_id) === uid || String(n.recipient) === uid)) {
      return true;
    }
    if (user.name && (n.recipient === user.name || n.recipient_name === user.name)) {
      return true;
    }
    return false;
  });

  const unreadCount = mine.filter((n) => n.unread).length;

  const markAsRead = useCallback(
    (id) => {
      dispatch({ type: "MARK_ONE_READ", id });
      apiClient.put(`/notifications/${id}/read`).catch(() => {});
    },
    [dispatch]
  );

  const markAllRead = useCallback(() => {
    dispatch({ type: "MARK_ALL_READ_FOR", recipientId: user?.id, recipientName: user?.name });
    apiClient.put("/notifications/read-all").catch(() => {});
  }, [dispatch, user]);

  const notify = useCallback(
    (recipient, title, body) => {
      dispatch({
        type: "ADD",
        payload: { id: `N${++notifSeq}-${Date.now()}`, recipient, title, body, unread: true, timestamp: new Date().toISOString() },
      });
    },
    [dispatch]
  );

  return { notifications: mine, unreadCount, loading: !hydrated, markAsRead, markAllRead, notify };
}
