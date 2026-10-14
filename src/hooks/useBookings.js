import { useContext, useState, useCallback } from "react";
import { BookingContext, normalizeBooking } from "../context/BookingContext";
import { useNotifications } from "./useNotifications";
import { useToast } from "./useToast";
import { useAuth } from "./useAuth";
import apiClient from "../api/apiClient";

/**
 * Custom hook — the single entry point for anything booking-related.
 * Communicates strictly with real backend API operations and real-time state updates.
 *
 * Enforces strict decoupling of service completion from payment processing:
 * marking a service as complete does NOT set payment to paid.
 */
export function useBookings() {
  const { bookings, dispatch, hydrated, refreshBookings } = useContext(BookingContext);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useNotifications();
  const { showToast } = useToast();
  const { user } = useAuth();

  const hasActiveDuplicate = useCallback(
    (customer, provider, serviceName) =>
      bookings.some(
        (b) =>
          b.customer === customer &&
          b.provider === provider &&
          b.service === serviceName &&
          (b.status === "Pending" || b.status === "Confirmed")
      ),
    [bookings]
  );

  const createBooking = useCallback(
    async (bookingData) => {
      setActionLoading(true);
      setError("");
      try {
        if (hasActiveDuplicate(bookingData.customer, bookingData.provider, bookingData.serviceName || bookingData.service)) {
          throw new Error(
            `You already have an active booking for ${bookingData.serviceName || bookingData.service} with ${bookingData.provider}. Reschedule that one from Booking History instead of creating a duplicate.`
          );
        }

        const bookingLat =
          bookingData.latitude ??
          bookingData.lat ??
          bookingData.location?.lat ??
          bookingData.location?.latitude ??
          bookingData.serviceLocation?.latitude ??
          bookingData.serviceLocation?.lat;
        const bookingLng =
          bookingData.longitude ??
          bookingData.lng ??
          bookingData.location?.lng ??
          bookingData.location?.longitude ??
          bookingData.serviceLocation?.longitude ??
          bookingData.serviceLocation?.lng;

        const backendPayload = {
          serviceId: bookingData.serviceId,
          providerId: bookingData.providerId,
          serviceName: bookingData.serviceName || bookingData.service,
          communityId: bookingData.communityId,
            community_id: bookingData.communityId,
            provider: bookingData.provider,
            date: bookingData.rawDate || bookingData.date,
            time: bookingData.time,
            address: bookingData.address,
            latitude: bookingLat != null ? Number(bookingLat) : null,
            longitude: bookingLng != null ? Number(bookingLng) : null,
            serviceLocation: bookingData.serviceLocation || {
              address: bookingData.address,
              latitude: bookingLat != null ? Number(bookingLat) : null,
              longitude: bookingLng != null ? Number(bookingLng) : null,
            },
            problemDescription: bookingData.problemDescription || bookingData.instructions || "",
            customerNotes: bookingData.instructions || bookingData.problemDescription || "",
            mediaAttachments: bookingData.mediaAttachments || [],
            paymentMethod: bookingData.paymentMethod || (bookingData.payment === "wallet" ? "wallet" : bookingData.payment === "card" || bookingData.payment === "upi" ? "card" : "cash"),
            amount: bookingData.rawAmount,
          };

        const res = await apiClient.post("/bookings", backendPayload);
        const data = res?.data?.data || res?.data;
        if (!data) {
          throw new Error("Failed to create booking: Invalid response from server");
        }

        const newBooking = normalizeBooking(data);
        dispatch({ type: "CREATE", payload: newBooking });
        notify(newBooking.provider, "New Booking Request", `${bookingData.customer} requested ${newBooking.service} on ${newBooking.date}.`);
        showToast("Booking request sent!", "success");
        if (typeof refreshBookings === "function") {
          refreshBookings();
        }
        return newBooking;
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Could not create booking.";
        setError(msg);
        showToast(msg, "error");
        throw new Error(msg);
      } finally {
        setActionLoading(false);
      }
    },
    [dispatch, notify, showToast, hasActiveDuplicate, refreshBookings]
  );

  const acceptBooking = useCallback(
    async (id) => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      try {
        await apiClient.put(`/bookings/${targetId}/status`, { status: "accepted" });
      } catch (err) {
        try {
          await apiClient.patch(`/bookings/${targetId}/accept`);
        } catch {
          const msg = err.response?.data?.message || err.message || "Failed to accept booking";
          showToast(msg, "error");
          throw err;
        }
      }
      dispatch({ type: "UPDATE_STATUS", id, changes: { status: "Confirmed" } });
      if (booking) notify(booking.customer, "Booking Confirmed", `${booking.provider} confirmed your ${booking.service} booking.`);
      showToast("Booking accepted", "success");
    },
    [dispatch, bookings, notify, showToast]
  );

  const rejectBooking = useCallback(
    async (id) => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      try {
        await apiClient.put(`/bookings/${targetId}/status`, { status: "rejected" });
      } catch (err) {
        try {
          await apiClient.patch(`/bookings/${targetId}/reject`);
        } catch {
          const msg = err.response?.data?.message || err.message || "Failed to reject booking";
          showToast(msg, "error");
          throw err;
        }
      }
      dispatch({ type: "UPDATE_STATUS", id, changes: { status: "Rejected" } });
      if (booking) notify(booking.customer, "Booking Declined", `${booking.provider} was unable to accept your ${booking.service} booking.`);
      showToast("Booking rejected", "info");
    },
    [dispatch, bookings, notify, showToast]
  );

  const completeBooking = useCallback(
    async (id) => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      let result;
      try {
        const res = await apiClient.put(`/bookings/${targetId}/status`, { status: "completed" });
        result = res?.data?.data || res?.data;
      } catch (err) {
        try {
          const res = await apiClient.patch(`/bookings/${targetId}/complete`);
          result = res?.data?.data || res?.data;
        } catch {
          const msg = err.response?.data?.message || err.message || "Failed to complete booking";
          showToast(msg, "error");
          throw err;
        }
      }
      const existingPayment = booking?.paymentStatus || (result?.payment_status === "paid" ? "Paid" : "Unpaid");
      dispatch({ type: "UPDATE_STATUS", id, changes: { status: "Completed", paymentStatus: existingPayment } });
      if (booking) {
        notify(booking.customer, "Service Completed", `Your ${booking.service} with ${booking.provider} is complete. You can now proceed to payment.`);
      }
      showToast("Marked as complete", "success");
    },
    [dispatch, bookings, notify, showToast]
  );

  const startTravel = useCallback(
    async (id) => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      try {
        await apiClient.put(`/bookings/${targetId}/status`, { status: "on_the_way" });
      } catch (err) {
        try {
          await apiClient.patch(`/bookings/${targetId}/start-travel`);
        } catch {
          const msg = err.response?.data?.message || err.message || "Failed to start travel";
          showToast(msg, "error");
          throw err;
        }
      }
      dispatch({ type: "UPDATE_STATUS", id, changes: { status: "On The Way" } });
      if (booking) notify(booking.customer, "Provider On The Way", `${booking.provider} is on the way for your ${booking.service} booking.`);
      showToast("Marked as on the way", "success");
    },
    [dispatch, bookings, notify, showToast]
  );

  const markArrived = useCallback(
    async (id) => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      try {
        await apiClient.put(`/bookings/${targetId}/status`, { status: "arrived" });
      } catch (err) {
        try {
          await apiClient.patch(`/bookings/${targetId}/arrived`);
        } catch {
          const msg = err.response?.data?.message || err.message || "Failed to mark arrived";
          showToast(msg, "error");
          throw err;
        }
      }
      dispatch({ type: "UPDATE_STATUS", id, changes: { status: "Arrived" } });
      if (booking) notify(booking.customer, "Provider Arrived", `${booking.provider} has arrived for your ${booking.service} booking.`);
      showToast("Marked as arrived", "success");
    },
    [dispatch, bookings, notify, showToast]
  );

  const startService = useCallback(
    async (id) => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      try {
        await apiClient.put(`/bookings/${targetId}/status`, { status: "in_progress" });
      } catch (err) {
        try {
          await apiClient.patch(`/bookings/${targetId}/start-service`);
        } catch {
          const msg = err.response?.data?.message || err.message || "Failed to start service";
          showToast(msg, "error");
          throw err;
        }
      }
      dispatch({ type: "UPDATE_STATUS", id, changes: { status: "In Progress" } });
      if (booking) notify(booking.customer, "Service Started", `Work on your ${booking.service} booking has started.`);
      showToast("Service started", "success");
    },
    [dispatch, bookings, notify, showToast]
  );

  const cancelBooking = useCallback(
    async (id, reason = "Cancelled by user") => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      try {
        await apiClient.put(`/bookings/${targetId}/cancel`, { cancellationReason: reason });
      } catch (err) {
        try {
          await apiClient.patch(`/bookings/${targetId}/cancel`, { cancellationReason: reason });
        } catch {
          const msg = err.response?.data?.message || err.message || "Failed to cancel booking";
          showToast(msg, "error");
          throw err;
        }
      }
      dispatch({ type: "UPDATE_STATUS", id, changes: { status: "Cancelled" } });
      if (booking) {
        const actorIsCustomer = user?.name === booking.customer;
        const recipient = actorIsCustomer ? booking.provider : booking.customer;
        const actorLabel = actorIsCustomer ? booking.customer : booking.provider;
        notify(recipient, "Booking Cancelled", `${actorLabel} cancelled the ${booking.service} booking.`);
      }
      showToast("Booking cancelled", "info");
    },
    [dispatch, bookings, notify, showToast, user]
  );

  const rescheduleBooking = useCallback(
    async (id, { date, time }) => {
      const booking = bookings.find((b) => b.id === id || b.dbId === id);
      const targetId = booking?.dbId || id;
      setActionLoading(true);
      setError("");
      try {
        const res = await apiClient.patch(`/bookings/${targetId}/reschedule`, { date, time });
        const result = res?.data?.data || res?.data || { date, time };
        dispatch({ type: "UPDATE_STATUS", id, changes: { date: result.date || date, time: result.time || time } });
        if (booking) {
          notify(booking.provider, "Booking Rescheduled", `${booking.customer} moved ${booking.service} to ${result.date || date} at ${result.time || time}.`);
        }
        showToast("Booking rescheduled", "success");
      } catch (err) {
        const msg = err.response?.data?.message || err.message || "Could not reschedule booking.";
        setError(msg);
        showToast(msg, "error");
        throw new Error(msg);
      } finally {
        setActionLoading(false);
      }
    },
    [dispatch, bookings, notify, showToast]
  );

  return {
    bookings,
    loading: !hydrated,
    actionLoading,
    error,
    createBooking,
    acceptBooking,
    rejectBooking,
    completeBooking,
    cancelBooking,
    rescheduleBooking,
    startTravel,
    markArrived,
    startService,
    hasActiveDuplicate,
    refreshBookings,
  };
}
