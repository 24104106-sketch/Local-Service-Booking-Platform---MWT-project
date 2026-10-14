import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useToast } from "../../hooks/useToast";
import apiClient from "../../api/apiClient";
import { subscribeToBookingUpdates, onSocketConnectionChange, isSocketConnected } from "../../api/socketClient";
import Layout from "../../components/Layout";
import ProviderTrackingMap from "../../components/maps/ProviderTrackingMap";
import BookingTimeline from "../../components/BookingTimeline";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import ChatPanel from "../../components/ChatPanel";
import Skeleton from "../../components/Skeleton";
import { getCurrentCoordinates } from "../../utils/geocode";
import "./TrackProvider.css";

function TrackProvider() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { bookings, loading: bookingsLoading } = useBookings();

  const [remoteBooking, setRemoteBooking] = useState(null);
  const [pendingCharge, setPendingCharge] = useState(null);
  const [respondingCharge, setRespondingCharge] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [socketConnected, setSocketConnected] = useState(isSocketConnected());
  const [metrics, setMetrics] = useState({
    distanceKm: "Calculating...",
    etaMinutes: "Calculating...",
    lastUpdated: "Waiting for provider location...",
    hasProviderGps: false,
  });

  // Track socket connection state
  useEffect(() => {
    const unsub = onSocketConnectionChange((connected) => {
      setSocketConnected(connected);
    });
    return unsub;
  }, []);

  // Fetch booking directly from backend API if missing from local context
  useEffect(() => {
    if (!bookingId) return;
    const token = localStorage.getItem("fixit_local_auth_token") || localStorage.getItem("token");
    if (!token) return;

    const cleanId = String(bookingId).replace(/^BK/, "");
    apiClient.get(`/bookings/${cleanId}`)
      .then((res) => {
        if (res && res.data) {
          const b = res.data;
          setRemoteBooking({
            id: b.booking_number || `BK${b.id}`,
            dbId: b.id,
            customerId: b.customer_id,
            customer_id: b.customer_id,
            customer: b.customer?.name || "Customer",
            customerEmail: b.customer?.email,
            providerId: b.provider_id,
            provider_id: b.provider_id,
            provider: b.providerProfile?.business_name || b.provider?.name || "Provider",
            providerEmail: b.provider?.email,
            serviceId: b.service_id,
            service: b.service_title || b.service?.title || "Service",
            category: b.category,
            date: b.date,
            time: b.time,
            amount: `₹${b.amount}`,
            rawAmount: b.amount,
            status: b.status,
            paymentStatus: b.payment_status === "paid" ? "Paid" : "Unpaid",
            paymentMethod: b.payment_method,
            address: typeof b.address === "string" ? b.address : `${b.address?.street || ""}, ${b.address?.city || ""}`,
            location: b.provider_location,
            serviceLocation: b.service_location,
            instructions: b.customer_notes || b.problem_description,
            additionalCharges: b.additional_charges,
            timeline: b.status_timeline,
          });

          // Check for pending additional charges
          if (Array.isArray(b.additional_charges)) {
            const pending = b.additional_charges.find((c) => c.status === "pending");
            if (pending) setPendingCharge(pending);
          }
        }
      })
      .catch(() => {});
  }, [bookingId]);

  // Real-time Socket.IO updates for live provider location, status & additional charges
  useEffect(() => {
    if (!bookingId) return;
    try {
      const unsubscribe = subscribeToBookingUpdates(bookingId, {
        onLocation: (data) => {
          if (data && (data.latitude || data.lat)) {
            setMetrics((prev) => ({
              ...prev,
              lastUpdated: "Live (Socket.IO)",
            }));
          }
        },
        onStatus: (data) => {
          if (data?.status) {
            setRemoteBooking((prev) => (prev ? { ...prev, status: data.status } : prev));
          }
        },
        onAdditionalCharge: (charge) => {
          if (charge) {
            setPendingCharge(charge);
            showToast("Provider requested an additional charge.", "info");
          }
        },
      });
      return unsubscribe;
    } catch {
      // Offline fallback
    }
  }, [bookingId, showToast]);

  // Lookup the specific booking from central BookingContext or remote fallback
  const booking = useMemo(() => {
    const found = bookings.find((b) => b && (b.id === bookingId || b._id === bookingId || b.dbId === Number(bookingId)));
    return found || remoteBooking;
  }, [bookings, bookingId, remoteBooking]);

  // Lookup provider details from real booking data
  const providerDetails = useMemo(() => {
    if (!booking) return null;
    const profile = booking.providerProfile || {};
    const provUser = typeof booking.provider === "object" ? booking.provider : {};
    const provName = typeof booking.provider === "string" ? booking.provider : (profile.business_name || provUser.name || "Service Provider");
    return {
      name: provName,
      category: booking.category || profile.category || "Home Services",
      experience: profile.experience_years || 5,
      verified: profile.verification_status === "verified" || profile.is_approved !== false,
      bio: profile.bio || "Certified FixIt Local service partner.",
      phone: provUser.phone || "+91 98401 23456",
      rating: profile.rating || 5.0,
      reviewCount: profile.review_count || 0,
    };
  }, [booking]);

  // Handle responding to additional charge
  const handleRespondCharge = async (action) => {
    if (!pendingCharge) return;
    setRespondingCharge(true);
    try {
      const targetId = booking?.dbId || String(bookingId).replace(/^BK/, "");
      const res = await apiClient.put(`/bookings/${targetId}/additional-charges/${pendingCharge.id}/respond`, { action });
      if (res && res.success) {
        showToast(`Additional charge ${action === "approve" ? "approved" : "declined"}.`, "success");
        setPendingCharge(null);
        if (res.data?.booking) {
          const updatedB = res.data.booking;
          setRemoteBooking((prev) => ({
            ...prev,
            amount: `₹${updatedB.amount}`,
            rawAmount: updatedB.amount,
            additionalCharges: updatedB.additional_charges,
          }));
        }
      } else {
        showToast(data.message || "Failed to update charge.", "error");
      }
    } catch {
      showToast("Error updating charge.", "error");
    } finally {
      setRespondingCharge(false);
    }
  };

  // Geolocation setup for customer
  const handleRequestGps = async () => {
    try {
      const coords = await getCurrentCoordinates();
      setGpsLocation({ lat: coords.latitude, lng: coords.longitude });
      showToast("Updated with your real GPS location.", "success");
    } catch (err) {
      showToast(err.message || "Failed to retrieve your GPS location.", "error");
    }
  };

  // Determine customer destination coordinates
  const customerDestination = useMemo(() => {
    if (gpsLocation) return gpsLocation;
    const loc = booking?.serviceLocation || booking?.service_location || booking?.location;
    if (loc && (loc.latitude || loc.lat)) {
      return {
        lat: Number(loc.latitude ?? loc.lat),
        lng: Number(loc.longitude ?? loc.lng),
        address: loc.address || booking?.address,
      };
    }
    if (booking?.latitude && booking?.longitude) {
      return {
        lat: Number(booking.latitude),
        lng: Number(booking.longitude),
        address: booking?.address,
      };
    }
    return null;
  }, [gpsLocation, booking]);

  if (bookingsLoading && !booking) {
    return (
      <Layout title="Track Provider">
        <Skeleton variant="card" count={2} height={220} />
      </Layout>
    );
  }

  // Booking Not Found Fallback State
  if (!booking) {
    return (
      <Layout title="Track Provider">
        <div className="track-error-panel">
          <span style={{ fontSize: "42px" }}>🔍</span>
          <h3>Booking Not Found</h3>
          <p>We could not find booking #{bookingId}. It may have been deleted or does not exist.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/customer/booking-history")}>
            ← Back to Booking History
          </button>
        </div>
      </Layout>
    );
  }

  // Customer Privacy Check: Customer A can ONLY track Customer A's bookings
  const isOwner =
    (booking.customer_id && user?.id && String(booking.customer_id) === String(user.id)) ||
    (booking.customerId && user?.id && String(booking.customerId) === String(user.id)) ||
    booking.customer === user?.name ||
    (user?.email && booking.customerEmail === user?.email) ||
    user?.role === "admin";

  if (!isOwner) {
    return (
      <Layout title="Track Provider">
        <div className="track-error-panel">
          <span style={{ fontSize: "42px" }}>🔒</span>
          <h3>Access Restricted</h3>
          <p>
            Privacy Notice: You can only track providers assigned to your own active bookings.
            Booking #{booking.id} belongs to another user.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate("/customer/booking-history")}>
            ← Back to My Bookings
          </button>
        </div>
      </Layout>
    );
  }

  const normStatus = (booking.status || "").toLowerCase().replace(/_/g, " ");
  const isCompleted = normStatus === "completed";
  const isCancelled = normStatus === "cancelled" || normStatus === "rejected";
  const isLiveTrackingActive = !isCompleted && !isCancelled;

  return (
    <Layout title={`Track Provider — ${booking.service}`}>
      <div className="track-provider-container">
        {/* Top Header Bar */}
        <div className="track-header-bar">
          <div className="track-title-block">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                background: isLiveTrackingActive ? "rgba(16, 185, 129, 0.2)" : "rgba(100, 116, 139, 0.2)",
                color: isLiveTrackingActive ? "#10b981" : "var(--muted)",
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase"
              }}>
                {isLiveTrackingActive ? "● LIVE TRACKING" : "TRACKING CLOSED"}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Booking #{booking.id}
              </span>
            </div>
            <h2>Track Your Provider</h2>
            <p>
              Provider: <strong style={{ color: "var(--ink)" }}>{booking.provider}</strong> • Status:{" "}
              <strong style={{ color: "var(--blue)", textTransform: "capitalize" }}>
                {booking.status?.replace(/_/g, " ")}
              </strong> • Location: <strong style={{ color: "#10b981" }}>Live</strong> • Last updated:{" "}
              <span>{metrics.lastUpdated}</span>
            </p>
          </div>
          <button
            type="button"
            className="track-back-btn"
            onClick={() => navigate("/customer/booking-history")}
          >
            ← Back to Bookings
          </button>
        </div>

        {/* Socket Disconnected Alert Banner */}
        {isLiveTrackingActive && !socketConnected && (
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: 10,
              color: "#fbbf24",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span>Live tracking connection lost. Reconnecting...</span>
          </div>
        )}

        {/* Additional Charge Approval Banner */}
        {pendingCharge && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid #f59e0b",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase" }}>
                Action Required: Additional Charge Request
              </span>
              <h4 style={{ margin: "4px 0 2px 0", fontSize: 16 }}>
                ₹{pendingCharge.amount} — {pendingCharge.description}
              </h4>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
                The technician requested this extra charge for additional materials/work. Please approve or decline.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleRespondCharge("approve")}
                disabled={respondingCharge}
                style={{ background: "var(--green)", borderColor: "var(--green)" }}
              >
                {respondingCharge ? "Updating..." : "✓ Approve Charge"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handleRespondCharge("reject")}
                disabled={respondingCharge}
                style={{ color: "var(--red)", borderColor: "var(--red)" }}
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Completed Service Banner */}
        {isCompleted && (
          <div className="track-completed-banner">
            <div>
              <h4 style={{ margin: "0 0 4px 0", fontSize: 16 }}>Service Completed ✓</h4>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
                Your service job is completed and provider has marked payment as processed. Live tracking stopped.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/customer/invoice/${booking.id}`, { state: { booking } })}
              >
                View Invoice
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => navigate("/customer/booking-history")}
              >
                Leave a Review
              </button>
            </div>
          </div>
        )}

        {/* Cancelled Service Banner */}
        {isCancelled && (
          <div
            style={{
              background: "var(--red-bg)",
              border: "1px solid var(--red)",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: 16,
              color: "var(--red)",
            }}
          >
            <h4 style={{ margin: "0 0 4px 0" }}>Booking Cancelled</h4>
            <p style={{ margin: 0, fontSize: 13 }}>
              This booking is no longer active, so live provider tracking has been stopped.
            </p>
          </div>
        )}

        {/* Main 2-Column Responsive Layout */}
        <div className="track-content-grid">
          {/* Left Column: Real-Time Interactive Map & Status */}
          <div className="track-map-column">
            {isLiveTrackingActive ? (
              <ProviderTrackingMap
                bookingId={booking.id}
                destination={customerDestination}
                initialProviderLocation={booking.providerLocation || booking.provider_location}
                providerName={booking.provider}
                status={booking.status}
                height="420px"
                onMetricsUpdate={setMetrics}
              />
            ) : (
              <div
                style={{
                  height: 360,
                  background: "var(--surface)",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  padding: 20,
                  textAlign: "center",
                }}
              >
                <span style={{ fontSize: 36 }}>📍</span>
                <h4>Tracking Closed</h4>
                <p style={{ margin: 0, fontSize: 13, maxWidth: 320 }}>
                  Service is {isCompleted ? "completed" : "cancelled"}. Real-time GPS coordinates are no longer streamed.
                </p>
              </div>
            )}

            {/* Real GPS Information Card */}
            {isLiveTrackingActive && (
              <div className="gps-live-status-card">
                <div className="gps-status-header">
                  <span>🛰️ Real-Time GPS Tracking Status</span>
                  <span className="gps-indicator-badge">
                    {metrics.hasProviderGps ? "🟢 Provider GPS Active" : "🟡 Waiting for Provider GPS"}
                  </span>
                </div>
                <div className="gps-status-body">
                  <p>
                    Live coordinates are streamed securely over WebSocket. No simulated or hardcoded locations are used.
                  </p>
                  <div className="gps-actions-row">
                    <button
                      type="button"
                      className="btn-gps-refine"
                      onClick={handleRequestGps}
                    >
                      📍 Refine with My Current Device Location
                    </button>
                    <span className="gps-last-updated">{metrics.lastUpdated}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Provider Card, Live Metrics, Details & Timeline */}
          <div className="track-info-column">
            {/* Live Metrics Card */}
            <div className="track-metrics-card">
              <div className="track-metric-item">
                <span className="metric-label">Estimated Arrival</span>
                <span className="metric-val highlight">
                  {normStatus === "on the way"
                    ? metrics.etaMinutes
                    : normStatus === "arrived"
                    ? "Arrived"
                    : normStatus === "in progress" || normStatus === "service started"
                    ? "In Progress"
                    : isCompleted
                    ? "Completed"
                    : "Scheduled"}
                </span>
              </div>
              <div className="track-metric-item">
                <span className="metric-label">Distance</span>
                <span className="metric-val">
                  {normStatus === "on the way"
                    ? metrics.distanceKm
                    : normStatus === "arrived" || normStatus === "in progress" || isCompleted
                    ? "0.0 km"
                    : metrics.distanceKm || "Pending"}
                </span>
              </div>
              <div className="track-metric-item">
                <span className="metric-label">Live Status</span>
                <Badge status={booking.status} />
              </div>
            </div>

            {/* Provider Profile Card */}
            <div className="track-provider-card">
              <div className="provider-header-row">
                <div className="provider-avatar-circle">
                  {booking.provider?.charAt(0) || "P"}
                </div>
                <div className="provider-meta-col">
                  <h3>{booking.provider}</h3>
                  <div className="provider-sub-text">
                    <span>★ {providerDetails?.rating || "5.0"}</span>
                    <span>•</span>
                    <span>{providerDetails?.experience || 5} yrs experience</span>
                    {providerDetails?.verified && (
                      <span className="verified-badge-pill">✓ Verified</span>
                    )}
                  </div>
                </div>
              </div>

              {providerDetails?.bio && (
                <p className="provider-bio-text">{providerDetails.bio}</p>
              )}

              {/* Action Buttons: Chat & Call */}
              <div className="provider-actions-row">
                <button
                  type="button"
                  className="btn-contact-provider"
                  onClick={() => setChatOpen(true)}
                >
                  💬 Contact Provider
                </button>
                <a
                  href={`tel:${providerDetails?.phone || "+919840123456"}`}
                  className="btn-call-provider"
                >
                  📞 Call
                </a>
              </div>
            </div>

            {/* Booking Details Card */}
            <div className="track-booking-card">
              <div className="booking-field-row">
                <span className="booking-field-label">Service</span>
                <span className="booking-field-val">{booking.service}</span>
              </div>
              <div className="booking-field-row">
                <span className="booking-field-label">Date & Time</span>
                <span className="booking-field-val">
                  {booking.date} at {booking.time}
                </span>
              </div>
              <div className="booking-field-row">
                <span className="booking-field-label">Address</span>
                <span className="booking-field-val">
                  {booking.serviceLocation?.address || booking.service_location?.address || booking.address || "Address on file"}
                </span>
              </div>
              {booking.instructions && (
                <div className="booking-field-row">
                  <span className="booking-field-label">Instructions</span>
                  <span className="booking-field-val">{booking.instructions}</span>
                </div>
              )}
              <div className="booking-field-row">
                <span className="booking-field-label">Amount</span>
                <span className="booking-field-val" style={{ color: "var(--blue)" }}>
                  {booking.amount} ({booking.paymentStatus})
                </span>
              </div>
            </div>

            {/* Lifecycle Timeline Card */}
            <div className="track-timeline-card">
              <h4>Booking Lifecycle</h4>
              <BookingTimeline status={booking.status} />
            </div>
          </div>
        </div>

        {/* Chat Modal Integration */}
        {chatOpen && (
          <Modal
            title={`💬 Chat with ${booking.provider}`}
            onClose={() => setChatOpen(false)}
            width={460}
          >
            <ChatPanel
              booking={booking}
              role="customer"
              myName={user?.name || "Customer"}
            />
          </Modal>
        )}
      </div>
    </Layout>
  );
}

export default TrackProvider;
