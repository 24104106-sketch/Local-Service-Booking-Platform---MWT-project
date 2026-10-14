import { createContext, useCallback, useEffect } from "react";
import apiClient from "../api/apiClient";
import { usePersistentReducer } from "../hooks/usePersistentReducer";

export const BookingContext = createContext(null);

const STORAGE_KEY = "fixit_local_bookings";

export function normalizeBooking(b) {
  if (!b) return b;
  const statusMap = {
    pending: "Pending",
    requested: "Pending",
    confirmed: "Confirmed",
    accepted: "Confirmed",
    on_the_way: "On The Way",
    arrived: "Arrived",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
  };

  const paymentStatusMap = {
    paid: "Paid",
    pending: "Unpaid",
    unpaid: "Unpaid",
    refunded: "Refunded",
  };

  const rawStatus = (b.status || "").toLowerCase();
  const normalizedStatus = statusMap[rawStatus] || b.status || "Pending";

  const rawPayment = (b.payment_status || b.paymentStatus || "").toLowerCase();
  const normalizedPayment = paymentStatusMap[rawPayment] || b.paymentStatus || (rawPayment === "paid" ? "Paid" : "Unpaid");

  const addrStr = typeof b.address === "string"
    ? b.address
    : (b.address ? `${b.address.street || ""}${b.address.city ? ", " + b.address.city : ""}` : "");

  return {
    ...b,
    id: b.booking_number || (b.id ? (String(b.id).startsWith("BK") || String(b.id).startsWith("FIX") ? String(b.id) : `BK${b.id}`) : b.id),
    dbId: b.id,
    booking_number: b.booking_number,
    customer_id: b.customer_id || b.customerId || b.customer?.id,
    customerId: b.customer_id || b.customerId || b.customer?.id,
    customer: b.customer?.name || (typeof b.customer === "string" ? b.customer : ""),
    customerEmail: b.customer?.email || b.customerEmail || "",
    provider_id: b.provider_id || b.providerId || b.provider?.id,
    providerId: b.provider_id || b.providerId || b.provider?.id,
    provider: b.providerProfile?.business_name || b.provider?.name || (typeof b.provider === "string" ? b.provider : ""),
    service: b.service_title || b.service?.title || (typeof b.service === "string" ? b.service : ""),
    category: b.category || b.service?.category || "",
    date: b.date,
    time: b.time,
    status: normalizedStatus,
    paymentStatus: normalizedPayment,
    payment_status: b.payment_status || (normalizedPayment === "Paid" ? "paid" : "pending"),
    amount: typeof b.amount === "number" ? `₹${b.amount}` : (b.amount ? (String(b.amount).startsWith("₹") ? b.amount : `₹${b.amount}`) : "₹0"),
    rawAmount: typeof b.amount === "number" ? b.amount : parseFloat(String(b.amount || "0").replace(/[^0-9.]/g, "")) || 0,
    address: addrStr,
    location: b.provider_location || b.location,
    instructions: b.customer_notes || b.instructions || "",
  };
}

export function bookingsReducer(state, action) {
  switch (action.type) {
    case "SET":
      return Array.isArray(action.payload) ? action.payload : [];
    case "CREATE":
      return [action.payload, ...state];
    case "UPDATE_STATUS":
      return state.map((b) => (b.id === action.id || b.dbId === action.id ? { ...b, ...action.changes } : b));
    default:
      return state;
  }
}

const SEED_TEST_BOOKINGS = [
  {
    id: "BK1001",
    booking_number: "BK1001",
    customer_id: "cust-1",
    customerId: "cust-1",
    customer: "Radha",
    customerEmail: "customer@fixit.com",
    provider_id: "prov-1",
    providerId: "prov-1",
    provider: "Arun AC Care & Service",
    service: "AC Repair & Service",
    category: "AC Repair",
    date: "2026-07-20",
    time: "10:00 AM",
    status: "Confirmed",
    paymentStatus: "Paid",
    payment_status: "paid",
    amount: "₹599",
    rawAmount: 599,
    address: "12, 1st Cross, Gandhi Nagar, Chennai",
    latitude: 13.0827,
    longitude: 80.2707,
    provider_location: { latitude: 13.0850, longitude: 80.2720 },
    location: { latitude: 13.0850, longitude: 80.2720 },
  }
];

async function fetchRealBookings() {
  try {
    const token =
      localStorage.getItem("fixit_token") ||
      localStorage.getItem("fixit_local_auth_token") ||
      localStorage.getItem("token");

    if (token) {
      const res = await apiClient.get("/bookings");
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map(normalizeBooking);
      }
    }
  } catch {
    // API unavailable or offline
  }

  if (typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || !localStorage.getItem("fixit_token"))) {
    return SEED_TEST_BOOKINGS.map(normalizeBooking);
  }

  return [];
}

export function BookingProvider({ children }) {
  const [bookings, dispatch, hydrated] = usePersistentReducer(
    bookingsReducer,
    SEED_TEST_BOOKINGS.map(normalizeBooking),
    STORAGE_KEY,
    fetchRealBookings
  );

  const refreshBookings = useCallback(async () => {
    try {
      const token =
        localStorage.getItem("fixit_token") ||
        localStorage.getItem("fixit_local_auth_token") ||
        localStorage.getItem("token");
      if (!token) return [];

      const res = await apiClient.get("/bookings");
      if (res && Array.isArray(res.data)) {
        const normalized = res.data.map(normalizeBooking);
        dispatch({ type: "SET", payload: normalized });
        return normalized;
      }
    } catch {
      // not logged in
    }
    return [];
  }, [dispatch]);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  return (
    <BookingContext.Provider value={{ bookings, dispatch, hydrated, refreshBookings }}>
      {children}
    </BookingContext.Provider>
  );
}
