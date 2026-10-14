import { useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useComplaints } from "../../hooks/useComplaints";
import Layout from "../../components/Layout";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import { useTranslation } from "../../hooks/useTranslation";

const COMPLAINT_TYPES = [
  "Service quality issue",
  "Provider no-show",
  "Payment not refunded",
  "Rude behavior",
  "Other",
];

const FAQ = [
  { q: "How do I cancel a booking?", a: "Go to Booking History and click Cancel next to any Pending or Confirmed booking. Completed bookings can't be cancelled." },
  { q: "How does Wallet payment work?", a: "Add money to your Wallet from the Wallet page, then choose Wallet as the payment method when booking — the amount is deducted instantly." },
  { q: "How do I contact my provider?", a: "Provider contact details are shared once a booking is confirmed. For issues, raise a complaint below and our team will step in." },
  { q: "When can I leave a review?", a: "Once a booking's status changes to Completed, a 'Leave a Review' option appears for it in Booking History." },
];

function Support() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { bookings } = useBookings();
  const { complaints, loading, actionLoading, raiseComplaint } = useComplaints();

  const [bookingId, setBookingId] = useState("");
  const [type, setType] = useState(COMPLAINT_TYPES[0]);
  const [description, setDescription] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  const myBookings = useMemo(() => bookings.filter((b) => b.customer === user?.name), [bookings, user]);
  const myComplaints = useMemo(() => complaints.filter((c) => c.raisedBy === user?.name), [complaints, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    const booking = myBookings.find((b) => b.id === bookingId);

    try {
      await raiseComplaint({
        raisedBy: user?.name,
        against: booking?.provider || "General",
        type,
        description,
      });
      setDescription("");
      setBookingId("");
    } catch {
      // error already surfaced via toast inside useComplaints
    }
  };

  return (
    <Layout title={t("support")}>
      <p className="page-intro">Raise an issue with a booking, or check the FAQ below.</p>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <form onSubmit={handleSubmit} className="stat-card" style={{ flex: 1, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Raise a Complaint</h3>

          <div className="field">
            <label>Related Booking (optional)</label>
            <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} disabled={actionLoading}>
              <option value="">General issue (no specific booking)</option>
              {myBookings.map((b) => (
                <option key={b.id} value={b.id}>{b.id} — {b.service} ({b.provider})</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Issue Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} disabled={actionLoading}>
              {COMPLAINT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Description</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what happened..." disabled={actionLoading} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={actionLoading}>
            {actionLoading ? "Submitting..." : "Submit Complaint"}
          </button>
        </form>

        <div style={{ flex: 1, minWidth: 320 }}>
          <h3 style={{ marginTop: 0 }}>Frequently Asked Questions</h3>
          {FAQ.map((item, i) => (
            <div key={item.q} className="stat-card" style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <strong>{item.q}</strong>
              {openFaq === i && <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6 }}>{item.a}</p>}
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ marginTop: 32 }}>Your Complaint History</h3>
      {loading ? (
        <Skeleton variant="table" count={2} />
      ) : myComplaints.length === 0 ? (
        <EmptyState icon="📢" title="No complaints raised yet" message="If something goes wrong with a booking, raise it above and our team will step in." />
      ) : (
        myComplaints.map((c) => (
          <div key={c.id} className="stat-card" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{c.type}</strong> <span style={{ color: "var(--muted)", fontSize: 11.5 }}>vs {c.against}</span>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11.5 }}>{c.date}</p>
            </div>
            <span className={`badge ${c.status.toLowerCase().replace(/\s+/g, "")}`}>{c.status}</span>
          </div>
        ))
      )}
    </Layout>
  );
}

export default Support;
