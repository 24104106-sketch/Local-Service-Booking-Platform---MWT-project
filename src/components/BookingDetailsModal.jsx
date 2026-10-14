import Modal from "./Modal";
import Badge from "./Badge";
import BookingTimeline from "./BookingTimeline";
import { useNavigate } from "react-router-dom";

/**
 * Full booking detail view in a modal — service, provider, schedule,
 * address/notes, price, live status timeline, and status-appropriate quick
 * actions (Track / Chat / Invoice). Used from both the Dashboard's
 * "upcoming booking" card and Booking History's "Details" action, so this
 * is the ONE place booking detail rendering lives rather than being
 * duplicated across those two pages.
 *
 * Status-driven actions here are intentionally just the read/navigate ones
 * (Track, Chat, View Invoice) — the stateful ones (Cancel, Reschedule,
 * Review) stay on Booking History's row where their existing forms/modals
 * already live, to avoid duplicating that logic in a second place.
 */
function BookingDetailsModal({ booking, onClose, onTrack, onChat }) {
  const navigate = useNavigate();
  if (!booking) return null;

  return (
    <Modal title={`Booking ${booking.id}`} onClose={onClose} width={460}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h4 style={{ margin: "0 0 2px" }}>{booking.service}</h4>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{booking.provider}</p>
        </div>
        <Badge status={booking.status} />
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        <span>📅 {booking.date} · {booking.time}</span>
        {booking.address && <span>📍 {booking.address}</span>}
        {booking.instructions && <span>📝 {booking.instructions}</span>}
        <span>💰 {booking.amount}</span>
      </div>

      <h4 style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", marginBottom: 10 }}>Progress</h4>
      <BookingTimeline status={booking.status} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {["Confirmed", "Provider Assigned", "On The Way", "Arrived", "Service Started"].includes(booking.status) && onTrack && (
          <button className="btn btn-primary" onClick={() => onTrack(booking)}>🚚 Track Provider</button>
        )}
        {booking.status !== "Cancelled" && booking.status !== "Rejected" && onChat && (
          <button className="btn" onClick={() => onChat(booking)}>💬 Chat</button>
        )}
        <button className="btn" onClick={() => navigate(`/customer/invoice/${booking.id}`, { state: { booking } })}>View Invoice</button>
      </div>
    </Modal>
  );
}

export default BookingDetailsModal;
