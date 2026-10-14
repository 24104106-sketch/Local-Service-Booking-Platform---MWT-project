import { useContext, useState, useCallback, useMemo } from "react";
import { ReviewContext } from "../context/ReviewContext";
import { useToast } from "./useToast";
import apiClient from "../api/apiClient";

/**
 * Custom hook — the single entry point for reviews. A review is tied to a
 * specific completed booking (mirrors the 1:1 Booking–Review relationship
 * from the original class diagram) so a customer can only review a booking
 * once, and any page can compute a provider's live rating from real reviews
 * instead of a static catalog number.
 *
 * Usage:
 *   const { reviews, addReview, hasReviewed, reviewsForProvider } = useReviews();
 */
export function useReviews() {
  const { reviews, dispatch, hydrated } = useContext(ReviewContext);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const reviewedBookingIds = useMemo(() => new Set(reviews.map((r) => r.bookingId)), [reviews]);
  const hasReviewed = useCallback((bookingId) => reviewedBookingIds.has(bookingId), [reviewedBookingIds]);

  const reviewsForProvider = useCallback(
    (providerName) => reviews.filter((r) => r.provider === providerName),
    [reviews]
  );

  const addReview = useCallback(
    async (data) => {
      setActionLoading(true);
      setError("");
      try {
        let review = null;
        try {
          const res = await apiClient.post("/reviews", {
            bookingId: data.bookingId,
            rating: data.rating,
            comment: data.comment
          });
          if (res && res.data) {
            const r = res.data;
            review = {
              id: `REV${r.id}`,
              dbId: r.id,
              bookingId: r.booking_id,
              customer: r.customer?.name || data.customer || "Customer",
              provider: r.provider?.name || data.provider || "Provider",
              service: r.service?.title || data.service || "Service",
              rating: Number(r.rating || data.rating),
              comment: r.comment || data.comment,
              date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            };
          }
        } catch (apiErr) {
          if (apiErr.message && !apiErr.message.includes("fetch") && !apiErr.message.includes("Network")) {
            throw apiErr;
          }
        }

        if (!review) {
          review = {
            id: `REV${Date.now()}`,
            bookingId: data.bookingId,
            customer: data.customer || "Customer",
            provider: data.provider || "Provider",
            service: data.service || "Service",
            rating: data.rating,
            comment: data.comment,
            date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          };
        }

        dispatch({ type: "ADD", payload: review });
        showToast("Thanks for your review!", "success");
        return review;
      } catch (err) {
        setError(err.message || "Could not submit review.");
        showToast(err.message || "Could not submit review.", "error");
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [dispatch, showToast]
  );

  return { reviews, loading: !hydrated, actionLoading, error, addReview, hasReviewed, reviewsForProvider };
}
