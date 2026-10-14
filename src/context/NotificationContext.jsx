import { createContext, useCallback, useEffect, useContext } from "react";
import apiClient from "../api/apiClient";
import { usePersistentReducer } from "../hooks/usePersistentReducer";
import { getSocket, connectSocket } from "../api/socketClient";
import { UserContext } from "./UserContext";

export const NotificationContext = createContext(null);

const STORAGE_KEY = "fixit_local_notifications";

export function normalizeNotification(n) {
  if (!n) return n;
  return {
    ...n,
    id: n.id,
    recipient: n.recipient || n.recipient_name || n.recipient_id,
    recipient_id: n.recipient_id,
    title: n.title,
    body: n.body || n.message,
    unread: n.read === false || n.unread === true,
    timestamp: n.createdAt || n.created_at || new Date().toISOString()
  };
}

export function notificationsReducer(state, action) {
  switch (action.type) {
    case "SET":
      return Array.isArray(action.payload) ? action.payload : [];
    case "ADD":
      return [action.payload, ...state];
    case "ADD_UNIQUE": {
      if (!action.payload) return state;
      const exists = state.some((n) => String(n.id) === String(action.payload.id));
      if (exists) return state;
      return [action.payload, ...state];
    }
    case "MARK_ONE_READ":
      return state.map((n) => (n.id === action.id ? { ...n, unread: false } : n));
    case "MARK_ALL_READ_FOR":
      return state.map((n) => {
        const matches =
          (action.recipientId && (String(n.recipient_id) === String(action.recipientId) || String(n.recipient) === String(action.recipientId))) ||
          (action.recipientName && (n.recipient === action.recipientName || n.recipient_name === action.recipientName)) ||
          (action.recipient && (n.recipient === action.recipient || String(n.recipient_id) === String(action.recipient)));
        return matches ? { ...n, unread: false } : n;
      });
    default:
      return state;
  }
}

async function fetchRealNotifications() {
  try {
    const token =
      localStorage.getItem("fixit_token") ||
      localStorage.getItem("fixit_local_auth_token") ||
      localStorage.getItem("token");
    if (!token) return [];

    const res = await apiClient.get("/notifications");
    const rawList = res?.data?.data?.notifications || res?.data?.notifications || res?.data;
    if (Array.isArray(rawList)) {
      return rawList.map(normalizeNotification);
    }
  } catch {
    // Offline or unauthorized
  }
  return [];
}

export function NotificationProvider({ children }) {
  const { user } = useContext(UserContext) || {};

  const [notifications, dispatch, hydrated] = usePersistentReducer(
    notificationsReducer,
    [],
    STORAGE_KEY,
    fetchRealNotifications
  );

  const refreshNotifications = useCallback(async () => {
    const fresh = await fetchRealNotifications();
    dispatch({ type: "SET", payload: fresh });
    return fresh;
  }, [dispatch]);

  // Connect to socket and listen for real-time notification events
  useEffect(() => {
    refreshNotifications();

    const currentUserId = user?.id || user?._id;
    const socket = currentUserId ? connectSocket(currentUserId) : getSocket();
    if (!socket) return;

    if (currentUserId) {
      socket.emit("join_user", currentUserId);
    }

    const handleIncomingNotification = (rawNotif) => {
      if (!rawNotif) return;
      const normalized = normalizeNotification(rawNotif);
      dispatch({ type: "ADD_UNIQUE", payload: normalized });
    };

    const handleReconnect = () => {
      refreshNotifications();
      if (currentUserId) {
        socket.emit("join_user", currentUserId);
      }
    };

    socket.on("notification", handleIncomingNotification);
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("notification", handleIncomingNotification);
      socket.off("connect", handleReconnect);
    };
  }, [user?.id, user?._id, refreshNotifications, dispatch]);

  return (
    <NotificationContext.Provider value={{ notifications, dispatch, hydrated, refreshNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
