import { useState, useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import { useTranslation } from "../../hooks/useTranslation";
import { parseAmount, formatCurrency } from "../../utils/currency";
import apiClient from "../../api/apiClient";

function Invoice() {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const location = useLocation();
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!location.state?.booking);

  useEffect(() => {
    if (!booking && bookingId) {
      const cleanId = String(bookingId).replace(/^BK/, "");
      apiClient.get(`/bookings/${cleanId}`)
        .then((res) => {
          if (res && res.data) {
            const b = res.data;
            setBooking({
              id: b.booking_number || `BK${b.id}`,
              service: b.service_title || b.service?.title || "Service",
              provider: b.providerProfile?.business_name || b.provider?.name || "Provider",
              date: b.date,
              time: b.time,
              amount: `₹${b.amount}`,
              paymentMethod: b.payment_method,
              paymentStatus: b.payment_status === "paid" ? "Paid" : (b.payment_status || "Pending"),
              additionalCharges: b.additional_charges || [],
              pricing: b.pricing
            });
          }
        })
        .catch(() => {
          // fallback default
          setBooking({ id: bookingId, service: "Service", provider: "Provider", amount: "₹0" });
        })
        .finally(() => setLoading(false));
    }
  }, [booking, bookingId]);

  if (loading || !booking) {
    return (
      <Layout title={t("invoice")}>
        <div className="stat-card" style={{ maxWidth: 640, padding: 30, textAlign: "center" }}>
          Loading invoice...
        </div>
      </Layout>
    );
  }

  const total = parseAmount(booking.amount);

  const visitingFee = Math.round(total * 0.05);
  const platformFee = Math.round(total * 0.03);
  const serviceCharge = total - visitingFee - platformFee;

  const rows = [
    { label: "Service Charge", amount: serviceCharge },
    { label: "Visiting Fee", amount: visitingFee },
    { label: "Platform Fee", amount: platformFee },
  ];

  const paymentMethodLabel = booking.paymentMethod
    ? booking.paymentMethod.charAt(0).toUpperCase() + booking.paymentMethod.slice(1)
    : "—";

  return (
    <Layout title={t("invoice")}>
      <div className="stat-card" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>FixIt Local</strong>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "var(--blue)", fontWeight: 700 }}>INVOICE</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>#INV-{booking.id}</div>
          </div>
        </div>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />

        <p>
          <strong>Service:</strong> {booking.service}
        </p>
        <p>
          <strong>Provider:</strong> {booking.provider}
        </p>
        <p>
          <strong>Date:</strong> {booking.date}
        </p>
        <p>
          <strong>Payment Method:</strong> {paymentMethodLabel}
        </p>
        <p>
          <strong>Payment Status:</strong>{" "}
          <span className={`badge ${(booking.paymentStatus || "").toLowerCase()}`}>
            {booking.paymentStatus || "Pending"}
          </span>
        </p>

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />

        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ color: "var(--muted)" }}>{r.label}</span>
            <span>{formatCurrency(r.amount)}</span>
          </div>
        ))}

        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
          <span>Total {booking.paymentStatus === "Paid" ? "Paid" : "Due"}</span>
          <span style={{ color: "var(--blue)" }}>{formatCurrency(total)}</span>
        </div>

        <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => window.print()}>
          Download / Print Invoice
        </button>
      </div>
    </Layout>
  );
}

export default Invoice;
