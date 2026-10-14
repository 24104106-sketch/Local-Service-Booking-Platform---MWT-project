import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useServices } from "../../hooks/useServices";
import { useTranslation } from "../../hooks/useTranslation";
import { formatCurrency } from "../../utils/currency";
import { getServiceCoverImage } from "../../utils/serviceImages";
import Layout from "../../components/Layout";
import BookingCard from "../../components/BookingCard";
import StatCard from "../../components/StatCard";
import AnimatedGrid from "../../components/AnimatedGrid";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import BookingModalHost from "../../components/booking/BookingModalHost";
import RecentlyAccessed from "../../components/customer/RecentlyAccessed";

const ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "provider_assigned",
  "accepted",
  "on_the_way",
  "arrived",
  "in_progress",
  "service started"
];

const SERVICE_CATEGORIES = [
  { id: "ac-repair", name: "AC Repair", icon: "❄️", desc: "Inspection, gas refill & maintenance", color: "#38bdf8" },
  { id: "cleaning", name: "Cleaning", icon: "🧹", desc: "Deep home, kitchen & sofa cleaning", color: "#34d399" },
  { id: "plumbing", name: "Plumbing", icon: "🔧", desc: "Leaks, piping & fixture repairs", color: "#60a5fa" },
  { id: "electrical", name: "Electrician", icon: "⚡", desc: "Wiring, MCB, lighting & fans", color: "#fbbf24" },
  { id: "pest-control", name: "Pest Control", icon: "🐜", desc: "Termite, bed bug & cockroach treatment", color: "#f87171" },
  { id: "carpentry", name: "Carpentry", icon: "🪚", desc: "Furniture repairs, locks & woodwork", color: "#fb923c" },
];

function Dashboard() {
  const { user } = useAuth();
  const { bookings, loading } = useBookings();
  const { activeServices } = useServices();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [detailsBooking, setDetailsBooking] = useState(null);
  const [trackingBooking, setTrackingBooking] = useState(null);
  const [chattingBooking, setChattingBooking] = useState(null);

  // Robust customer matching by ID, name, or email
  const list = useMemo(() => {
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

  const normStatus = (s) => (s || "").toLowerCase().replace(/_/g, " ");

  const total = list.length;
  const completed = list.filter((b) => normStatus(b.status) === "completed").length;
  const pending = list.filter((b) => ["pending", "confirmed", "provider assigned", "accepted"].includes(normStatus(b.status))).length;
  const cancelled = list.filter((b) => ["cancelled", "rejected"].includes(normStatus(b.status))).length;

  const upcoming = useMemo(() => {
    return list.find((b) => ACTIVE_STATUSES.includes((b.status || "").toLowerCase()));
  }, [list]);

  const recommendedServices = useMemo(() => activeServices.slice(0, 3), [activeServices]);

  const isEnRoute = upcoming && (upcoming.status || "").toLowerCase().replace(/_/g, " ") === "on the way";

  return (
    <Layout title={t("customerDashboard")}>
      <div className="page-header-row mb-3">
        <div>
          <h2 style={{ margin: "0 0 4px 0" }}>Hello, {user?.name || "Customer"} 👋</h2>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
            Welcome back — manage your bookings and find verified local experts.
          </p>
        </div>
        <div className="card-actions-row">
          <button
            type="button"
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", fontSize: 14, fontWeight: 700 }}
            onClick={() => navigate("/customer/book")}
          >
            <span>+</span> Book a Service
          </button>
        </div>
      </div>

      <AnimatedGrid>
        <StatCard icon="📅" label="Total Bookings" value={total} sub="All time" />
        <StatCard icon="✅" label="Completed Services" value={completed} sub="Successfully finished" />
        <StatCard icon="⏳" label="Active / Pending" value={pending} sub="In progress or scheduled" />
        <StatCard icon="✕" label="Cancelled Bookings" value={cancelled} sub="Cancelled requests" />
      </AnimatedGrid>

      {/* Upcoming Active Booking Card */}
      {!loading && upcoming && (
        <div
          className="stat-card"
          style={{
            marginBottom: 26,
            borderLeft: "4px solid var(--blue)",
            background: isEnRoute ? "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(15,23,42,0.8) 100%)" : undefined,
            boxShadow: isEnRoute ? "0 0 20px rgba(59,130,246,0.2)" : undefined
          }}
        >
          {isEnRoute && (
            <div
              className="flex-row items-center gap-2 mb-3"
              style={{
                background: "rgba(37,99,235,0.25)",
                border: "1px solid rgba(59,130,246,0.4)",
                padding: "8px 14px",
                borderRadius: 8,
                color: "#93c5fd",
                fontSize: 13,
                fontWeight: 600,
                animation: "pulse 2s infinite"
              }}
            >
              <span>🚗</span>
              <span>Your provider is on the way to your location!</span>
            </div>
          )}

          <div className="card-header-row">
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Upcoming Active Booking
              </span>
              <h3 style={{ margin: "4px 0 6px 0", fontSize: 18 }}>{upcoming.service}</h3>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
                Provider: <strong style={{ color: "var(--ink)" }}>{upcoming.provider}</strong> · Date: <strong>{upcoming.date}</strong> at <strong>{upcoming.time}</strong>
              </p>
            </div>
            <span
              style={{
                background: "rgba(59,130,246,0.15)",
                color: "var(--blue)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                textTransform: "capitalize"
              }}
            >
              {upcoming.status?.replace(/_/g, " ")}
            </span>
          </div>

          <div className="card-actions-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setDetailsBooking(upcoming)}
            >
              View Details
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: "rgba(37, 99, 235, 0.2)",
                color: "#93c5fd",
                borderColor: "rgba(59, 130, 246, 0.4)",
                fontWeight: 600
              }}
              onClick={() => navigate(`/customer/track/${upcoming.id}`)}
            >
              🚚 Track Provider
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setChattingBooking(upcoming)}
            >
              💬 Message Provider
            </button>
          </div>
        </div>
      )}

      {/* Service Categories Grid */}
      <div style={{ margin: "28px 0" }}>
        <div className="page-header-row mb-3">
          <div>
            <h3 style={{ margin: "0 0 2px 0" }}>Service Categories</h3>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
              Browse verified local service professionals by specialty
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12.5, color: "var(--blue)" }}
            onClick={() => navigate("/customer/services")}
          >
            All Services →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {SERVICE_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="stat-card flex-column gap-1"
              style={{
                cursor: "pointer",
                padding: "16px",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
              onClick={() => navigate(`/customer/services?category=${cat.name}`)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = cat.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  background: "rgba(255,255,255,0.05)",
                  marginBottom: 4
                }}
              >
                {cat.icon}
              </div>
              <strong style={{ fontSize: 14 }}>{cat.name}</strong>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.35 }}>
                {cat.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Persistent Recently Accessed / Viewed Section */}
      <RecentlyAccessed limit={6} />

      {/* Recommended Services Section */}
      <div style={{ margin: "28px 0" }}>
        <div className="page-header-row mb-3">
          <h3 style={{ margin: 0 }}>Recommended For You</h3>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 12.5, color: "var(--blue)" }}
            onClick={() => navigate("/customer/services")}
          >
            Explore All →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {recommendedServices.map((s) => (
            <div
              key={s.id}
              className="stat-card"
              style={{
                padding: 0,
                overflow: "hidden",
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}
              onClick={() => navigate(`/customer/services/${s.id}`, { state: { service: s } })}
            >
              <div style={{ width: "100%", height: 120, position: "relative", overflow: "hidden", background: "#060b17" }}>
                <img
                  src={getServiceCoverImage(s)}
                  alt={s.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  loading="lazy"
                />
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#93c5fd",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  {s.category}
                </span>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: 14 }}>{s.name}</h4>
                <p style={{ margin: "0 0 8px 0", fontSize: 11.5, color: "var(--muted)" }}>
                  {s.provider} · <span style={{ color: "#fbbf24" }}>★ {s.rating || 5}</span>
                </p>
                <div className="flex-row justify-between items-center">
                  <strong style={{ color: "var(--blue)", fontSize: 14 }}>{formatCurrency(s.price)}</strong>
                  <span style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}>Book →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Bookings Section */}
      <div style={{ margin: "28px 0" }}>
        <div className="page-header-row mb-3">
          <h3 style={{ margin: 0 }}>{t("recentBookings")}</h3>
          {list.length > 0 && (
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: 12.5, color: "var(--blue)" }}
              onClick={() => navigate("/customer/booking-history")}
            >
              View Full History →
            </button>
          )}
        </div>

        {loading ? (
          <Skeleton variant="table" count={3} />
        ) : list.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No bookings yet"
            message="Browse services to make your first booking with a verified local expert."
            actionLabel="Book a Service"
            onAction={() => navigate("/customer/book")}
          />
        ) : (
          list.slice(0, 5).map((b) => (
            <BookingCard key={b.id} booking={b} onClick={setDetailsBooking} />
          ))
        )}
      </div>

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
    </Layout>
  );
}

export default Dashboard;
