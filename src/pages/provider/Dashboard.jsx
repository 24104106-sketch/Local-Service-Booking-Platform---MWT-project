import { useMemo, useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useBookings } from "../../hooks/useBookings";
import { useChat } from "../../hooks/useChat";
import { useServices } from "../../hooks/useServices";
import { parseAmount, formatCurrency } from "../../utils/currency";
import apiClient from "../../api/apiClient";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import DataTable from "../../components/DataTable";
import AnimatedGrid from "../../components/AnimatedGrid";
import Skeleton from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import BookingModalHost from "../../components/booking/BookingModalHost";
import { useTranslation } from "../../hooks/useTranslation";
import { emitProviderLocation } from "../../api/socketClient";

const COLUMNS = [
  { key: "customer", label: "Customer" },
  { key: "service", label: "Service" },
  { key: "date", label: "Date" },
  { key: "status", label: "Status" },
];

function ProviderDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeServicesByProvider } = useServices();
  const {
    bookings,
    loading,
    acceptBooking,
    rejectBooking,
    completeBooking,
    startTravel,
    markArrived,
    startService,
    cancelBooking,
  } = useBookings();
  const { unreadCountForBooking } = useChat();

  const [locationBooking, setLocationBooking] = useState(null);
  const [chattingBooking, setChattingBooking] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    apiClient.get("/providers/profile/me")
      .then((res) => {
        if (isMounted && res && res.data) {
          setProfile(res.data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const normStatus = (s) => (s || "").toLowerCase().replace(/_/g, " ");

  const myRequests = useMemo(() => {
    return bookings.filter((b) => {
      if (!b) return false;
      const pid = b.provider_id || b.providerId || (typeof b.provider === "object" ? b.provider?.id : null);
      if (pid && user?.id && String(pid) === String(user.id)) return true;
      const pname = typeof b.provider === "string" ? b.provider : b.provider?.name;
      if (pname && user?.name && pname.toLowerCase() === user.name.toLowerCase()) return true;
      const pemail = b.providerEmail || (typeof b.provider === "object" ? b.provider?.email : null);
      if (pemail && user?.email && pemail.toLowerCase() === user.email.toLowerCase()) return true;
      return false;
    });
  }, [bookings, user]);

  const activeTravelBooking = useMemo(
    () => myRequests.find((b) => {
      const s = normStatus(b.status);
      return ["on the way", "arrived", "in progress", "service started"].includes(s);
    }),
    [myRequests]
  );

  const [gpsPermissionState, setGpsPermissionState] = useState("idle"); // 'idle' | 'prompting' | 'granted' | 'denied' | 'unavailable' | 'timeout'
  const [gpsErrorMessage, setGpsErrorMessage] = useState("");
  const [lastLocationShared, setLastLocationShared] = useState(null);
  const [lastTrackedBookingNumber, setLastTrackedBookingNumber] = useState(null);

  // Live GPS tracking beacon: broadcast route coordinates only during active travel/service status
  useEffect(() => {
    if (!activeTravelBooking) {
      return;
    }

    setLastTrackedBookingNumber(activeTravelBooking.booking_number || activeTravelBooking.id);

    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsPermissionState("unavailable");
      setGpsErrorMessage("Geolocation is not supported by your browser or device.");
      return;
    }

    setGpsPermissionState((prev) => (prev === "granted" ? "granted" : "prompting"));
    setGpsErrorMessage("");

    const bookingTargetId = activeTravelBooking.dbId || activeTravelBooking.id;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          setGpsPermissionState("unavailable");
          setGpsErrorMessage("Invalid coordinates returned by device GPS.");
          return;
        }

        setGpsPermissionState("granted");
        setGpsErrorMessage("");
        setLastLocationShared({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ? Math.round(accuracy) : null,
          speed: speed ? Math.round(speed) : null,
          heading: heading || 0,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        });

        // 1. Broadcast via WebSocket room
        emitProviderLocation(bookingTargetId, {
          latitude,
          longitude,
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || null,
          heading: heading || 0,
          speed: speed || 0,
          timestamp: new Date().toISOString(),
        });

        // 2. Also persist via REST endpoint
        apiClient.post("/providers/location", {
          lat: latitude,
          lng: longitude,
          accuracy,
          heading,
          speed,
          bookingId: bookingTargetId,
        }).catch(() => {});
      },
      (err) => {
        if (err.code === 1) { // PERMISSION_DENIED
          setGpsPermissionState("denied");
          setGpsErrorMessage("Location permission is required to share your live location with the customer. Please enable location permissions in your browser.");
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setGpsPermissionState("unavailable");
          setGpsErrorMessage("Unable to get your current location. Please enable GPS/location services on your device.");
        } else if (err.code === 3) { // TIMEOUT
          setGpsPermissionState("timeout");
          setGpsErrorMessage("Location request timed out. Retrying GPS connection...");
        } else {
          setGpsPermissionState("unavailable");
          setGpsErrorMessage(err.message || "Unable to acquire location.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeTravelBooking]);

  const activeServices = useMemo(
    () => (user?.name ? activeServicesByProvider(user.name).length : 0),
    [activeServicesByProvider, user?.name]
  );

  const completedJobs = useMemo(() => myRequests.filter((b) => b.status === "Completed"), [myRequests]);
  const monthLabel = new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const monthlyEarnings = useMemo(
    () =>
      completedJobs
        .filter((b) => b.date && b.date.includes(monthLabel))
        .reduce((sum, b) => sum + parseAmount(b.amount), 0),
    [completedJobs, monthLabel]
  );

  const todaysBookingsCount = useMemo(() => {
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    return myRequests.filter((b) => b.date === today).length;
  }, [myRequests]);

  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const handleToggleAvailability = async () => {
    if (!profile) return;
    const nextStatus = profile.availability_status === "AVAILABLE" ? "OFFLINE" : "AVAILABLE";
    setTogglingAvailability(true);
    try {
      const res = await apiClient.put("/providers/availability", { availabilityStatus: nextStatus });
      if (res && res.data) {
        setProfile((prev) => ({ ...prev, availability_status: res.data.availabilityStatus, is_available: res.data.isAvailable }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingAvailability(false);
    }
  };

  return (
    <Layout title={t("providerDashboard")}>
      <p className="page-intro">Welcome, {user?.name || "Provider"} — here's your business overview.</p>

      {activeTravelBooking ? (
        <div
          style={{
            padding: "16px 20px",
            background: gpsPermissionState === "denied"
              ? "rgba(239, 68, 68, 0.12)"
              : gpsPermissionState === "granted"
              ? "rgba(16, 185, 129, 0.12)"
              : "rgba(245, 158, 11, 0.12)",
            border: `1px solid ${
              gpsPermissionState === "denied"
                ? "rgba(239, 68, 68, 0.4)"
                : gpsPermissionState === "granted"
                ? "rgba(16, 185, 129, 0.4)"
                : "rgba(245, 158, 11, 0.4)"
            }`,
            borderRadius: "var(--radius, 12px)",
            marginBottom: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>
                {gpsPermissionState === "denied" ? "⚠️" : gpsPermissionState === "granted" ? "🛰️" : "⏳"}
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{
                    color: gpsPermissionState === "denied" ? "#ef4444" : gpsPermissionState === "granted" ? "#10b981" : "#f59e0b",
                    fontSize: 14,
                    letterSpacing: 0.3
                  }}>
                    {gpsPermissionState === "granted" ? "LIVE LOCATION ● Sharing with customer" : "LOCATION SHARING ACTIVE"}
                  </strong>
                  <span style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    color: "var(--ink)",
                    fontWeight: 600
                  }}>
                    Booking #{activeTravelBooking.id}
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12.5 }}>
                  Customer: <strong>{activeTravelBooking.customer}</strong> • Service: <strong>{activeTravelBooking.service}</strong>
                </p>
              </div>
            </div>
            <span style={{
              background: activeTravelBooking.status === "On The Way" ? "#059669" : "#2563eb",
              color: "#fff",
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: "uppercase"
            }}>
              {activeTravelBooking.status}
            </span>
          </div>

          {/* Status Metadata Bar */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(0, 0, 0, 0.15)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--muted)"
          }}>
            <div>
              GPS Permission:{" "}
              <strong style={{ color: gpsPermissionState === "granted" ? "#10b981" : gpsPermissionState === "denied" ? "#ef4444" : "#f59e0b" }}>
                {gpsPermissionState === "granted" ? "Granted ✓" : gpsPermissionState === "denied" ? "Denied ✕" : "Checking..."}
              </strong>
            </div>
            <div>
              Tracking Status:{" "}
              <strong style={{ color: gpsPermissionState === "granted" ? "#10b981" : "var(--muted)" }}>
                {gpsPermissionState === "granted" ? "Broadcasting Real GPS" : "Awaiting Coordinates"}
              </strong>
            </div>
            <div>
              Last Update:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {lastLocationShared ? `${lastLocationShared.time} (±${lastLocationShared.accuracy || 10}m)` : "Waiting for GPS fix..."}
              </strong>
            </div>
          </div>

          {/* User Error Message if Permission Denied or Unavailable */}
          {gpsErrorMessage && (
            <div style={{
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 6,
              color: "#f87171",
              fontSize: 12.5,
              fontWeight: 500
            }}>
              ⚠️ {gpsErrorMessage}
            </div>
          )}
        </div>
      ) : lastTrackedBookingNumber ? (
        <div
          style={{
            padding: "10px 16px",
            background: "rgba(100, 116, 139, 0.08)",
            border: "1px solid rgba(100, 116, 139, 0.2)",
            borderRadius: "var(--radius, 12px)",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--muted)",
            fontSize: 12.5
          }}
        >
          <span>⏹️</span>
          <span>Location sharing stopped. Tracking is inactive for completed/cancelled bookings.</span>
        </div>
      ) : null}

      {profile && (profile.verification_status === "pending" || profile.is_approved === false) && (
        <div
          style={{
            padding: "14px 18px",
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "var(--radius)",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 24 }}>⏳</span>
          <div>
            <strong style={{ color: "#d97706", fontSize: 14 }}>Application Status: Pending Admin Review</strong>
            <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12.5 }}>
              Your {profile.category || "service"} provider profile has been submitted and is currently pending administrator review. You will be activated in the verified provider pool and appear in nearby recommendations once approved.
            </p>
          </div>
        </div>
      )}

      {profile && profile.is_approved && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 18px",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Operational Availability:</span>
            {profile.availability_status === "BUSY" ? (
              <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#d97706", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                ● BUSY (Active Job in Progress)
              </span>
            ) : profile.availability_status === "AVAILABLE" ? (
              <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#059669", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                ● AVAILABLE (Live in Nearby Recommendations)
              </span>
            ) : (
              <span style={{ background: "var(--stripe)", color: "var(--muted)", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                ○ OFFLINE (Not Accepting New Bookings)
              </span>
            )}
          </div>
          {profile.availability_status !== "BUSY" && (
            <button
              type="button"
              className={`btn btn-sm ${profile.availability_status === "AVAILABLE" ? "btn-outline" : "btn-primary"}`}
              onClick={handleToggleAvailability}
              disabled={togglingAvailability}
            >
              {profile.availability_status === "AVAILABLE" ? "Go Offline" : "Go Available Now"}
            </button>
          )}
        </div>
      )}

      <AnimatedGrid>
        <StatCard icon="🧰" label="Active Services" value={activeServices || 3} sub="Listed live" />
        <StatCard icon="📅" label="Today's Bookings" value={todaysBookingsCount} sub="Scheduled today" />
        <StatCard icon="✅" label="Completed Jobs" value={completedJobs.length} sub="All time" />
        <StatCard icon="📊" label="Monthly Earnings" value={formatCurrency(monthlyEarnings)} sub="This month" />
      </AnimatedGrid>

      <h3>{t("bookingRequests")}</h3>
      {loading ? (
        <Skeleton variant="table" count={3} />
      ) : myRequests.length === 0 ? (
        <EmptyState icon="📋" title="No booking requests yet" message="New requests from customers will show up here." />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={myRequests}
          renderActions={(row) => {
            const canShowLocation = row.status !== "Completed" && row.status !== "Cancelled" && row.status !== "Rejected";
            return (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {row.status === "Pending" && (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => acceptBooking(row.id)}>
                      Accept
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => rejectBooking(row.id)}>
                      Reject
                    </button>
                  </>
                )}
                {row.status === "Confirmed" && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => startTravel(row.id)}>
                    🚚 Start Travel
                  </button>
                )}
                {row.status === "On The Way" && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => markArrived(row.id)}>
                    📍 Mark Arrived
                  </button>
                )}
                {row.status === "Arrived" && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => startService(row.id)}>
                    🔧 Start Service
                  </button>
                )}
                {row.status === "Service Started" && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => completeBooking(row.id)}>
                    ✅ Mark Complete
                  </button>
                )}
                {["Confirmed", "On The Way", "Arrived", "Service Started"].includes(row.status) && (
                  <button type="button" className="btn btn-sm" onClick={() => cancelBooking(row.id)}>
                    Cancel
                  </button>
                )}
                {canShowLocation && (
                  <button type="button" className="btn btn-sm" onClick={() => setLocationBooking(row)}>
                    📍 Location
                  </button>
                )}
                {row.status !== "Rejected" && (
                  <button type="button" className="btn btn-sm" onClick={() => setChattingBooking(row)}>
                    💬 Chat
                    {unreadCountForBooking(row.id, "provider") > 0 && (
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
                        {unreadCountForBooking(row.id, "provider")}
                      </span>
                    )}
                  </button>
                )}
                {!canShowLocation && row.status === "Rejected" && (
                  <span style={{ fontSize: 11.5, color: "var(--faint)" }}>No actions</span>
                )}
              </div>
            );
          }}
        />
      )}

      <BookingModalHost
        locationBooking={locationBooking}
        onCloseLocation={() => setLocationBooking(null)}
        chattingBooking={chattingBooking}
        onCloseChatting={() => setChattingBooking(null)}
        role="provider"
        currentUserName={user?.name}
      />
    </Layout>
  );
}

export default ProviderDashboard;
