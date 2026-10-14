import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Status Badge Component with semantic FixIt Local color tokens
 */
export function StatusBadge({ status }) {
  const norm = String(status || "").toLowerCase().replace(/_/g, " ");

  let className = "chat-badge chat-badge-neutral";
  if (norm.includes("completed") || norm.includes("captured") || norm.includes("success") || norm.includes("paid")) {
    className = "chat-badge chat-badge-green";
  } else if (norm.includes("on the way") || norm.includes("arrived") || norm.includes("in progress")) {
    className = "chat-badge chat-badge-blue";
  } else if (norm.includes("pending") || norm.includes("authorized")) {
    className = "chat-badge chat-badge-amber";
  } else if (norm.includes("cancelled") || norm.includes("rejected") || norm.includes("refunded") || norm.includes("failed")) {
    className = "chat-badge chat-badge-red";
  } else if (norm.includes("confirmed") || norm.includes("accepted")) {
    className = "chat-badge chat-badge-teal";
  }

  const label = norm
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return <span className={className}>{label}</span>;
}

/**
 * Provider Card - Displays verified provider details, rating, distance, price & action buttons
 */
export function ProviderCard({ data, onAction }) {
  const navigate = useNavigate();
  if (!data) return null;

  const {
    name,
    verified = true,
    rating = 5.0,
    experience = "2 yrs experience",
    category = "Home Services",
    price = "₹450/hr",
    distance = "Nearby",
    availability = "Available Today",
    recommendationScore,
  } = data;

  const handleBook = () => {
    if (onAction) {
      onAction({
        action: "book_service",
        payload: { providerId: data.userId || data.id, providerName: name, category },
        path: "/customer/book",
        state: { provider: data }
      });
    } else {
      navigate("/customer/book", { state: { provider: data } });
    }
  };

  const handleView = () => {
    navigate(`/customer/providers/${encodeURIComponent(name)}`);
  };

  return (
    <div className="chat-card chat-provider-card">
      <div className="chat-card-header">
        <div className="chat-provider-info">
          <div className="chat-provider-avatar">👨‍🔧</div>
          <div>
            <div className="chat-provider-name-row">
              <h4 className="chat-provider-name">{name}</h4>
              {verified && <span className="chat-verified-badge" title="Verified Professional">✓ Verified</span>}
            </div>
            <div className="chat-provider-meta">
              <span className="chat-rating">★ {Number(rating).toFixed(1)}</span>
              <span className="chat-meta-sep">•</span>
              <span className="chat-experience">{experience}</span>
            </div>
          </div>
        </div>
        {recommendationScore && (
          <span className="chat-rec-badge">Top Match</span>
        )}
      </div>

      <div className="chat-provider-body">
        <div className="chat-category-tag">{category}</div>
        <div className="chat-provider-stats">
          <span className="chat-price">{price}</span>
          <span className="chat-meta-sep">•</span>
          <span className="chat-distance">📍 {distance}</span>
        </div>
        <div className="chat-availability-row">
          <span className="chat-avail-dot" /> {availability}
        </div>
      </div>

      <div className="chat-card-actions">
        <button type="button" className="chat-btn chat-btn-outline" onClick={handleView}>
          View Details
        </button>
        <button type="button" className="chat-btn chat-btn-primary" onClick={handleBook}>
          Book Now
        </button>
      </div>
    </div>
  );
}

/**
 * Booking Status Card - Displays booking details with real status badge
 */
export function BookingStatusCard({ data, onAction }) {
  const navigate = useNavigate();
  if (!data) return null;

  const {
    bookingId,
    bookingNumber,
    serviceTitle,
    providerName,
    status,
    date,
    time,
    amount,
    address,
  } = data;

  const handleTrack = () => {
    if (bookingId) {
      navigate(`/customer/tracking/${bookingId}`);
    } else {
      navigate("/customer/booking-history");
    }
  };

  const handleDetails = () => {
    if (bookingId) {
      navigate(`/customer/bookings/${bookingId}`);
    } else {
      navigate("/customer/booking-history");
    }
  };

  const canTrack = ["confirmed", "accepted", "on_the_way", "arrived", "in_progress"].includes(String(status).toLowerCase());

  return (
    <div className="chat-card chat-booking-card">
      <div className="chat-card-header">
        <div>
          <span className="chat-card-label">Booking #{bookingNumber || bookingId}</span>
          <h4 className="chat-card-title">{serviceTitle || "Home Service"}</h4>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="chat-card-details">
        {providerName && (
          <div className="chat-detail-row">
            <span className="chat-detail-label">Provider</span>
            <span className="chat-detail-value">{providerName}</span>
          </div>
        )}
        {(date || time) && (
          <div className="chat-detail-row">
            <span className="chat-detail-label">Schedule</span>
            <span className="chat-detail-value">{[date, time].filter(Boolean).join(" at ")}</span>
          </div>
        )}
        {address && (
          <div className="chat-detail-row">
            <span className="chat-detail-label">Location</span>
            <span className="chat-detail-value chat-truncate">{typeof address === "object" ? address.street || address.city : address}</span>
          </div>
        )}
        {amount && (
          <div className="chat-detail-row">
            <span className="chat-detail-label">Amount</span>
            <span className="chat-detail-value chat-amount">{amount}</span>
          </div>
        )}
      </div>

      <div className="chat-card-actions">
        {canTrack && (
          <button type="button" className="chat-btn chat-btn-primary" onClick={handleTrack}>
            📍 Live Tracking
          </button>
        )}
        <button type="button" className="chat-btn chat-btn-outline" onClick={handleDetails}>
          View Booking
        </button>
      </div>
    </div>
  );
}

/**
 * Booking Summary Card - For final confirmation before booking creation
 */
export function BookingSummaryCard({ data, onAction }) {
  const navigate = useNavigate();
  if (!data) return null;

  const { service, provider, date, time, location, amount } = data;

  const handleConfirm = () => {
    if (onAction) {
      onAction({
        action: "confirm_booking",
        payload: data,
        path: "/customer/book",
        state: { prefill: data }
      });
    } else {
      navigate("/customer/book", { state: { prefill: data } });
    }
  };

  const handleChange = () => {
    if (onAction) {
      onAction({ action: "change_booking_details" });
    }
  };

  const handleCancel = () => {
    if (onAction) {
      onAction({ action: "abort_booking" });
    }
  };

  return (
    <div className="chat-card chat-summary-card">
      <div className="chat-card-header">
        <h4 className="chat-card-title">📋 Booking Summary</h4>
        <span className="chat-summary-badge">Pending Confirmation</span>
      </div>

      <div className="chat-card-details">
        <div className="chat-detail-row">
          <span className="chat-detail-label">Service</span>
          <span className="chat-detail-value">{service}</span>
        </div>
        <div className="chat-detail-row">
          <span className="chat-detail-label">Provider</span>
          <span className="chat-detail-value">{provider}</span>
        </div>
        <div className="chat-detail-row">
          <span className="chat-detail-label">Date & Time</span>
          <span className="chat-detail-value">{date} • {time}</span>
        </div>
        <div className="chat-detail-row">
          <span className="chat-detail-label">Location</span>
          <span className="chat-detail-value">{location}</span>
        </div>
        <div className="chat-detail-row chat-total-row">
          <span className="chat-detail-label">Estimated Amount</span>
          <span className="chat-detail-value chat-amount">{amount}</span>
        </div>
      </div>

      <div className="chat-card-actions">
        <button type="button" className="chat-btn chat-btn-primary" onClick={handleConfirm}>
          ✓ Confirm Booking
        </button>
        <button type="button" className="chat-btn chat-btn-outline" onClick={handleChange}>
          Change Details
        </button>
        <button type="button" className="chat-btn chat-btn-ghost" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Live Tracking Card - Shows live GPS status, distance, ETA and live tracking launch
 */
export function LiveTrackingCard({ data, onAction }) {
  const navigate = useNavigate();
  if (!data) return null;

  const {
    bookingId,
    bookingNumber,
    providerName,
    status = "On the Way",
    distance = "2.4 km",
    eta = "8 mins",
    lastUpdated = "Just now",
  } = data;

  const handleOpenTracking = () => {
    if (bookingId) {
      navigate(`/customer/tracking/${bookingId}`);
    } else {
      navigate("/customer/booking-history");
    }
  };

  return (
    <div className="chat-card chat-tracking-card">
      <div className="chat-card-header">
        <div className="chat-live-pulse-wrapper">
          <span className="chat-live-pulse-dot" />
          <h4 className="chat-card-title">LIVE PROVIDER TRACKING</h4>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="chat-tracking-grid">
        <div className="chat-tracking-metric">
          <span className="chat-metric-label">Provider</span>
          <span className="chat-metric-val">{providerName}</span>
        </div>
        <div className="chat-tracking-metric">
          <span className="chat-metric-label">Distance</span>
          <span className="chat-metric-val">{distance}</span>
        </div>
        <div className="chat-tracking-metric">
          <span className="chat-metric-label">ETA</span>
          <span className="chat-metric-val chat-eta">{eta}</span>
        </div>
        <div className="chat-tracking-metric">
          <span className="chat-metric-label">Updated</span>
          <span className="chat-metric-val chat-faint-text">{lastUpdated}</span>
        </div>
      </div>

      <div className="chat-card-actions">
        <button type="button" className="chat-btn chat-btn-primary chat-btn-full" onClick={handleOpenTracking}>
          📍 Open Live Tracking Map
        </button>
      </div>
    </div>
  );
}

/**
 * Payment Card - Displays verified payment details
 */
export function PaymentCard({ data, onAction }) {
  const navigate = useNavigate();
  if (!data) return null;

  const {
    bookingNumber,
    amount,
    status = "captured",
    gateway = "Razorpay",
    date = "Today",
  } = data;

  return (
    <div className="chat-card chat-payment-card">
      <div className="chat-card-header">
        <div>
          <span className="chat-card-label">Payment Receipt</span>
          <h4 className="chat-card-title">Booking #{bookingNumber}</h4>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="chat-card-details">
        <div className="chat-detail-row">
          <span className="chat-detail-label">Amount Paid</span>
          <span className="chat-detail-value chat-amount">{amount}</span>
        </div>
        <div className="chat-detail-row">
          <span className="chat-detail-label">Payment Gateway</span>
          <span className="chat-detail-value">{gateway}</span>
        </div>
        <div className="chat-detail-row">
          <span className="chat-detail-label">Date</span>
          <span className="chat-detail-value">{date}</span>
        </div>
      </div>

      <div className="chat-card-actions">
        <button type="button" className="chat-btn chat-btn-outline" onClick={() => navigate("/customer/wallet")}>
          View In Wallet
        </button>
      </div>
    </div>
  );
}

/**
 * Cancellation Confirmation Card - Safeguards against accidental cancellation
 */
export function CancellationConfirmCard({ data, onAction }) {
  if (!data) return null;
  const { bookingNumber, serviceTitle, amount } = data;

  return (
    <div className="chat-card chat-warning-card">
      <div className="chat-card-header">
        <h4 className="chat-card-title">⚠️ Confirm Cancellation</h4>
      </div>

      <p className="chat-warning-text">
        Are you sure you want to cancel booking <strong>#{bookingNumber}</strong> ({serviceTitle})?
        If payment was held, the refund will be initiated immediately.
      </p>

      <div className="chat-card-actions">
        <button
          type="button"
          className="chat-btn chat-btn-danger"
          onClick={() => onAction?.({ action: "confirm_cancel", payload: data })}
        >
          Yes, Cancel Booking
        </button>
        <button
          type="button"
          className="chat-btn chat-btn-outline"
          onClick={() => onAction?.({ action: "abort_cancel" })}
        >
          Keep Booking
        </button>
      </div>
    </div>
  );
}

/**
 * Support / Complaint Card
 */
export function SupportCard({ data, onAction }) {
  const navigate = useNavigate();
  if (!data) return null;
  const { helpline = "1800-425-FIXIT", email = "support@fixitlocal.com", hours = "7 AM - 10 PM" } = data;

  return (
    <div className="chat-card chat-support-card">
      <div className="chat-card-header">
        <h4 className="chat-card-title">🆘 FixIt Local Customer Support</h4>
        <span className="chat-badge chat-badge-blue">24/7 Priority</span>
      </div>

      <div className="chat-card-details">
        <div className="chat-detail-row">
          <span className="chat-detail-label">Helpline</span>
          <span className="chat-detail-value">{helpline}</span>
        </div>
        <div className="chat-detail-row">
          <span className="chat-detail-label">Email</span>
          <span className="chat-detail-value">{email}</span>
        </div>
        <div className="chat-detail-row">
          <span className="chat-detail-label">Hours</span>
          <span className="chat-detail-value">{hours}</span>
        </div>
      </div>

      <div className="chat-card-actions">
        <button type="button" className="chat-btn chat-btn-primary" onClick={() => navigate("/customer/complaints")}>
          📢 File Support Ticket
        </button>
      </div>
    </div>
  );
}

/**
 * Service List Card - Displays services in a clean grid of standalone cards
 * Format:
 * ┌──────────────────────────┐
 * │ Plumbing Fix             │
 * │ ₹XXX                     │
 * │ ⭐ 4.7                   │
 * │                          │
 * │ [Book Service]           │
 * └──────────────────────────┘
 */
export function ServiceListCard({ data, onAction }) {
  const navigate = useNavigate();
  if (!data || !Array.isArray(data.services) || data.services.length === 0) return null;

  return (
    <div className="chat-service-grid" aria-label="Available services">
      {data.services.map((svc) => (
        <div key={svc.id} className="chat-card chat-service-item-card">
          <div className="chat-service-item-header">
            <h4 className="chat-service-title">{svc.title || svc.name}</h4>
            <div className="chat-service-price">₹{svc.price}</div>
          </div>
          <div className="chat-service-meta">
            <span className="chat-rating">⭐ {svc.rating ? Number(svc.rating).toFixed(1) : "4.7"}</span>
            {svc.category && <span className="chat-service-cat">{svc.category}</span>}
          </div>
          <div className="chat-card-actions">
            <button
              type="button"
              className="chat-btn chat-btn-primary"
              onClick={() => {
                if (onAction) {
                  onAction({
                    action: "book_service",
                    payload: { serviceId: svc.id, serviceName: svc.title, price: svc.price, category: svc.category },
                    path: "/customer/book",
                    state: { service: svc }
                  });
                } else {
                  navigate("/customer/book", { state: { service: svc } });
                }
              }}
            >
              Book Service
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Universal Card Dispatcher
 */
export function DynamicChatCard({ card, onAction }) {
  if (!card || !card.type) return null;

  switch (card.type) {
    case "provider_card":
      return <ProviderCard data={card.data} onAction={onAction} />;
    case "service_list":
      return <ServiceListCard data={card.data} onAction={onAction} />;
    case "booking_status":
      return <BookingStatusCard data={card.data} onAction={onAction} />;
    case "booking_summary":
      return <BookingSummaryCard data={card.data} onAction={onAction} />;
    case "live_tracking":
      return <LiveTrackingCard data={card.data} onAction={onAction} />;
    case "payment_card":
      return <PaymentCard data={card.data} onAction={onAction} />;
    case "cancellation_confirm":
      return <CancellationConfirmCard data={card.data} onAction={onAction} />;
    case "support_card":
      return <SupportCard data={card.data} onAction={onAction} />;
    default:
      return null;
  }
}
