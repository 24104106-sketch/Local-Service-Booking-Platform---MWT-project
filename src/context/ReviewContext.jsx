import { createContext } from "react";
import apiClient from "../api/apiClient";
import { usePersistentReducer } from "../hooks/usePersistentReducer";

export const ReviewContext = createContext(null);

const STORAGE_KEY = "fixit_local_reviews";

export function reviewsReducer(state, action) {
  switch (action.type) {
    case "SET":
      return Array.isArray(action.payload) ? action.payload : [];
    case "ADD":
      return [action.payload, ...state];
    default:
      return state;
  }
}

const fetchRealReviews = async () => {
  try {
    const res = await apiClient.get('/reviews');
    if (res && res.data && Array.isArray(res.data)) {
      return res.data.map(r => ({
        id: `REV${r.id}`,
        dbId: r.id,
        bookingId: r.booking_id,
        customer: r.customer?.name || "Customer",
        provider: r.provider?.name || "Provider",
        service: r.service?.title || "Service",
        rating: Number(r.rating || 5),
        comment: r.comment || "",
        date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Recently"
      }));
    }
  } catch {
    // fallback
  }
  return [];
};

export function ReviewProvider({ children }) {
  const [reviews, dispatch, hydrated] = usePersistentReducer(
    reviewsReducer,
    [],
    STORAGE_KEY,
    fetchRealReviews
  );

  return (
    <ReviewContext.Provider value={{ reviews, dispatch, hydrated }}>
      {children}
    </ReviewContext.Provider>
  );
}
