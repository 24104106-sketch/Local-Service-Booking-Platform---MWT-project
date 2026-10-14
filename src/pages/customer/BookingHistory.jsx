import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useReviews } from "../../hooks/useReviews";
import { useChat } from "../../hooks/useChat";
import { usePagination } from "../../hooks/usePagination";
import { useSearch } from "../../hooks/useSearch";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import Skeleton from "../../components/Skeleton";
import SearchInput from "../../components/SearchInput";
import Modal from "../../components/Modal";
import BookingModalHost from "../../components/booking/BookingModalHost";
import { useTranslation } from "../../hooks/useTranslation";

const COLUMNS = [
  { key: "id", label: "Booking ID" },
  { key: "service", label: "Service" },
  { key: "provider", label: "Provider" },
  { key: "date", label: "Booking Date" },
  { key: "status", label: "Status" },
  { key: "paymentStatus", label: "Payment" },
];

const PAGE_SIZE = 6;

const norm = (s) => (s || "").toLowerCase().replace(/_/g, " ");

const STATUS_GROUPS = {
  All: () => true,
  Upcoming: (s) => ["pending", "confirmed", "provider assigned", "accepted"].includes(norm(s)),
  Active: (s) => ["on the way", "arrived", "in progress", "service started"].includes(norm(s)),
  Completed: (s) => norm(s) === "completed",
  Cancelled: (s) => norm(s) === "cancelled" || norm(s) === "rejected",
};

const TRACKABLE_STATUSES = [
  "confirmed",
  "provider assigned",
  "accepted",
  "on the way",
  "arrived",
  "in progress",
  "service started",
];

function BookingHistory() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { bookings, loading, cancelBooking, rescheduleBooking, actionLoading: rescheduleLoading } = useBookings();
  const { hasReviewed, addReview, actionLoading: reviewLoading } = useReviews();
  const { unreadCountForBooking } = useChat();

  const [statusFilter, setStatusFilter] = useState("All");
  const [reviewingBooking, setReviewingBooking] = useState(null);
  const [trackingBooking, setTrackingBooking] = useState(null);
  const [chattingBooking, setChattingBooking] = useState(null);
  const [reschedulingBooking, setReschedulingBooking] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("Change of plans");
  const [detailsBooking, setDetailsBooking] = useState(null);

  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00 AM");
  const [rescheduleError, setRescheduleError] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [searchParams] = useSearchParams();

  // Robust customer filtering by ID, name, or email
  const mine = useMemo(() => {
    return bookings.filter((b) => {
      if (!b) return false;
      const cid = b.customer_id || b.customerId || (typeof b.customer === "object" ? b.customer?.id : null);
      if (cid && user?.id && String(cid) === String(user.id)) return true;
      const cname = typeof b.customer === "string" ? b.customer : b.customer?.name;
      if (cname && user?.name && cname.toLowerCase() === user.name.toLowerCase()) return true;
      const cemail = b.customerEmail || (typeof b.customer === "object" ? b.customer?.email : null);
      if (cemail && user?.email && cemail.toLowerCase() === user.email.toLowerCase()) return true;
      return false;
    });
  }, [bookings, user]);

  const counts = useMemo(() => {
    const c = { All: mine.length, Upcoming: 0, Active: 0, Completed: 0, Cancelled: 0 };
    mine.forEach((b) => {
      if (STATUS_GROUPS.Upcoming(b.status)) c.Upcoming++;
      if (STATUS_GROUPS.Active(b.status)) c.Active++;
      if (STATUS_GROUPS.Completed(b.status)) c.Completed++;
      if (STATUS_GROUPS.Cancelled(b.status)) c.Cancelled++;
    });
    return c;
  }, [mine]);

  const statusFiltered = useMemo(
    () => mine.filter((b) => STATUS_GROUPS[statusFilter](b.status)),
    [mine, statusFilter]
  );

  const { query, setQuery, results: visible } = useSearch(statusFiltered, {
    keys: ["id", "service", "provider"],
    initialQuery: searchParams.get("q") || "",
  });

  const { page, totalPages, paginated, nextPage, prevPage, hasNext, hasPrev } = usePagination(visible, PAGE_SIZE);

  const startReview = (booking) => {
    setReviewingBooking(booking);
    setRating(5);
    setComment("");
  };

  const startReschedule = (booking) => {
    setReschedulingBooking(booking);
    setNewDate("");
    setNewTime(booking.time || "10:00 AM");
    setRescheduleError("");
  };

  const submitReschedule = async (e) => {
    e.preventDefault();
    if (!newDate) {
      setRescheduleError("Please pick a new date.");
      return;
    }
    try {
      await rescheduleBooking(reschedulingBooking.id, { date: newDate, time: newTime });
      setReschedulingBooking(null);
    } catch (err) {
      setRescheduleError(err.message || "Could not reschedule.");
    }
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancellingBooking) return;
    try {
      await cancelBooking(cancellingBooking.id, cancelReason);
      setCancellingBooking(null);
    } catch {
      // Toast already surfaced
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await addReview({
        bookingId: reviewingBooking.dbId || reviewingBooking.id,
        customer: user?.name,
        provider: reviewingBooking.provider,
        service: reviewingBooking.service,
        rating,
        comment,
      });
      setReviewingBooking(null);
    } catch {
      // Toast already surfaced
    }
  };

  return (
    <Layout title={t("bookingHistory")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0" }}>{t("bookingHistory")}</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            Track, reschedule, review, and manage all your home service bookings.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/customer/book")}
        >
          + Book New Service
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 6 }}>
        {Object.keys(STATUS_GROUPS).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn btn-sm ${statusFilter === tab ? "btn-primary" : ""}`}
            onClick={() => setStatusFilter(tab)}
            style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
          >
            <span>{tab}</span>
            <span
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 999,
                background: statusFilter === tab ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
              }}
            >
              {counts[tab] || 0}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by booking id, service, provider..."
          style={{ flex: 1, minWidth: 220 }}
        />
      </div>

      {reviewingBooking && (
        <form onSubmit={submitReview} className="stat-card" style={{ maxWidth: 500, marginBottom: 20 }}>
          <h4 style={{ marginTop: 0 }}>
            Review {reviewingBooking.provider} — {reviewingBooking.service}
          </h4>
          <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: -4 }}>
            Share your experience to help other customers and support top service quality.
          </p>
          <div className="field">
            <label>Rating (1–5 Stars)</label>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} disabled={reviewLoading}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n} Star{n > 1 ? "s" : ""})
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Feedback &amp; Comments</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Was the provider punctual, polite, and thorough? Any details..."
              disabled={reviewLoading}
            />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={reviewLoading}>
              {reviewLoading ? "Submitting..." : "Submit Review"}
            </button>
            <button type="button" className="btn" onClick={() => setReviewingBooking(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Skeleton variant="table" count={3} />
      ) : (
        <>
          <DataTable
            columns={COLUMNS}
            rows={paginated}
            renderActions={(row) => {
              const currentNorm = norm(row.status);
              const isPendingOrConfirmed = ["pending", "confirmed", "provider assigned", "accepted"].includes(currentNorm);
              const isCompleted = currentNorm === "completed";
              const isTrackable = TRACKABLE_STATUSES.includes(currentNorm);
              const isCancelled = ["cancelled", "rejected"].includes(currentNorm);

              return (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" className="btn btn-sm" onClick={() => setDetailsBooking(row)}>
                    Details
                  </button>

                  {isPendingOrConfirmed && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ color: "var(--red)", borderColor: "rgba(239,68,68,0.3)" }}
                      onClick={() => setCancellingBooking(row)}
                    >
                      Cancel
                    </button>
                  )}

                  {isPendingOrConfirmed && (
                    <button type="button" className="btn btn-sm" onClick={() => startReschedule(row)}>
                      📅 Reschedule
                    </button>
                  )}

                  {!isCancelled && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setChattingBooking(row)}
                      style={{ position: "relative" }}
                    >
                      💬 Chat
                      {unreadCountForBooking(row.id, "customer") > 0 && (
                        <span
                          style={{
                            marginLeft: 6,
                            background: "var(--red)",
                            color: "#fff",
                            borderRadius: 999,
                            padding: "1px 6px",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {unreadCountForBooking(row.id, "customer")}
                        </span>
                      )}
                    </button>
                  )}

                  {isTrackable && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => navigate(`/customer/track/${row.id}`)}
                    >
                      🚚 Track Provider
                    </button>
                  )}

                  {isCompleted &&
                    (hasReviewed(row.dbId || row.id) ? (
                      <span style={{ fontSize: 11.5, color: "var(--faint)", alignSelf: "center" }}>Reviewed ✓</span>
                    ) : (
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => startReview(row)}>
                        Leave Review
                      </button>
                    ))}
                </div>
              );
            }}
          />

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 18 }}>
              <button type="button" className="btn" onClick={prevPage} disabled={!hasPrev}>
                ← Previous
              </button>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Page {page} of {totalPages}
              </span>
              <button type="button" className="btn" onClick={nextPage} disabled={!hasNext}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Cancellation Reason Modal */}
      {cancellingBooking && (
        <Modal
          title={`Cancel Booking #${cancellingBooking.id}`}
          onClose={() => setCancellingBooking(null)}
          width={420}
        >
          <form onSubmit={handleConfirmCancel}>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -4 }}>
              Are you sure you want to cancel your booking for{" "}
              <strong>{cancellingBooking.service}</strong> with {cancellingBooking.provider}?
            </p>
            <div className="field">
              <label>Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              >
                <option value="Change of plans">Change of plans</option>
                <option value="Found alternative service">Found alternative service</option>
                <option value="Selected wrong date or time">Selected wrong date or time</option>
                <option value="Issue resolved on its own">Issue resolved on its own</option>
                <option value="Emergency or unexpected delay">Emergency or unexpected delay</option>
                <option value="Other">Other reason</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="submit"
                className="btn"
                style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
              >
                Confirm Cancellation
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setCancellingBooking(null)}
              >
                Keep Booking
              </button>
            </div>
          </form>
        </Modal>
      )}

      <BookingModalHost
        detailsBooking={detailsBooking}
        onCloseDetails={() => setDetailsBooking(null)}
        trackingBooking={trackingBooking}
        onCloseTracking={() => setTrackingBooking(null)}
        chattingBooking={chattingBooking}
        onCloseChatting={() => setChattingBooking(null)}
        role="customer"
        currentUserName={user?.name}
        onOpenTrack={(b) => {
          setDetailsBooking(null);
          navigate(`/customer/track/${b.id}`);
        }}
        onOpenChat={(b) => {
          setDetailsBooking(null);
          setChattingBooking(b);
        }}
      />

      {reschedulingBooking && (
        <Modal
          title={`📅 Reschedule — ${reschedulingBooking.service}`}
          onClose={() => setReschedulingBooking(null)}
          width={380}
        >
          <form onSubmit={submitReschedule}>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 12 }}>
              Currently scheduled for {reschedulingBooking.date} at {reschedulingBooking.time}. Select your new slot:
            </p>
            <div className="field">
              <label>New Date</label>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                disabled={rescheduleLoading}
              />
            </div>
            <div className="field">
              <label>New Time Slot</label>
              <select value={newTime} onChange={(e) => setNewTime(e.target.value)} disabled={rescheduleLoading}>
                <option>09:00 AM</option>
                <option>11:00 AM</option>
                <option>01:00 PM</option>
                <option>03:00 PM</option>
                <option>05:00 PM</option>
                <option>07:00 PM</option>
              </select>
            </div>
            {rescheduleError && <p style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>{rescheduleError}</p>}
            <button type="submit" className="btn btn-primary" disabled={rescheduleLoading}>
              {rescheduleLoading ? "Saving..." : "Confirm New Time"}
            </button>
          </form>
        </Modal>
      )}
    </Layout>
  );
}

export default BookingHistory;
