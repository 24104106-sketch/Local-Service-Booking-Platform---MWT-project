import { createContext, useCallback, useEffect } from "react";
import apiClient from "../api/apiClient";
import { usePersistentReducer } from "../hooks/usePersistentReducer";

export const ComplaintContext = createContext(null);

const STORAGE_KEY = "fixit_local_complaints";

export function normalizeComplaint(c) {
  if (!c) return c;
  return {
    ...c,
    id: c.ticket_id || (c.id ? `TKT-${c.id}` : `TKT-${Date.now()}`),
    dbId: c.id,
    type: c.category || c.type || "Service Issue",
    raisedBy: c.user_name || c.raisedBy || "User",
    against: c.against || c.provider_name || (c.booking ? c.booking.service_title : "Service Provider"),
    bookingId: c.booking_number || c.bookingId || (c.booking ? c.booking.booking_number : "") || "",
    description: c.description || c.subject || "",
    status: c.status ? (c.status.charAt(0).toUpperCase() + c.status.slice(1).replace(/_/g, " ")) : "Pending",
    createdAt: c.createdAt || c.created_at || new Date().toISOString()
  };
}

export function complaintsReducer(state, action) {
  switch (action.type) {
    case "SET":
      return Array.isArray(action.payload) ? action.payload : [];
    case "CREATE":
      return [action.payload, ...state];
    case "UPDATE_STATUS":
      return state.map((c) => (c.id === action.id || c.dbId === action.id ? { ...c, status: action.status } : c));
    default:
      return state;
  }
}

async function fetchRealComplaints() {
  try {
    const token =
      localStorage.getItem("fixit_token") ||
      localStorage.getItem("fixit_local_auth_token") ||
      localStorage.getItem("token");
    if (!token) return [];

    let endpoint = "/complaints/my";
    try {
      const userRaw = localStorage.getItem("fixit_user") || localStorage.getItem("fixit_local_user");
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        if (parsed?.role === "admin") {
          endpoint = "/complaints";
        }
      }
    } catch {
      // ignore
    }

    const res = await apiClient.get(endpoint);
    const data = res?.data?.data || res?.data;
    if (Array.isArray(data)) {
      return data.map(normalizeComplaint);
    }
  } catch {
    // Offline or unauthorized
  }
  return [];
}

export function ComplaintProvider({ children }) {
  const [complaints, dispatch, hydrated] = usePersistentReducer(
    complaintsReducer,
    [],
    STORAGE_KEY,
    fetchRealComplaints
  );

  const refreshComplaints = useCallback(async () => {
    const fresh = await fetchRealComplaints();
    if (fresh.length > 0) {
      dispatch({ type: "SET", payload: fresh });
    }
    return fresh;
  }, [dispatch]);

  useEffect(() => {
    refreshComplaints();
  }, [refreshComplaints]);

  return (
    <ComplaintContext.Provider value={{ complaints, dispatch, hydrated, refreshComplaints }}>
      {children}
    </ComplaintContext.Provider>
  );
}
