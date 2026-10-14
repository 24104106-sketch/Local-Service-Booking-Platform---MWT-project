// The 6-stage booking lifecycle, in order. "Rejected"/"Cancelled" are
// handled separately below (they interrupt the line rather than sit on it).
const STAGES = [
  { key: "Pending", label: "Booking Requested" },
  { key: "Confirmed", label: "Provider Accepted" },
  { key: "On The Way", label: "Provider On The Way" },
  { key: "Arrived", label: "Provider Arrived" },
  { key: "Service Started", label: "Service Started" },
  { key: "Completed", label: "Completed" },
];

/**
 * Reusable booking progress timeline — ONE implementation used everywhere a
 * booking's lifecycle needs to be visualized (currently BookingDetailsModal;
 * available for provider/admin booking views too), so the status→stage
 * mapping is defined exactly once instead of re-derived per page.
 *
 * Usage: <BookingTimeline status={booking.status} />
 */
function BookingTimeline({ status }) {
  if (status === "Cancelled" || status === "Rejected") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--red-bg)", borderRadius: 8 }}>
        <span style={{ fontSize: 16 }}>✕</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--red)" }}>
          {status === "Cancelled" ? "This booking was cancelled." : "This booking request was declined."}
        </span>
      </div>
    );
  }

  const currentIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {STAGES.map((stage, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const active = i === currentIndex;
        const upcoming = currentIndex >= 0 && i > currentIndex;
        return (
          <div key={stage.key} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: done ? "var(--green)" : active ? "var(--blue)" : "var(--border-strong)",
                  color: done || active ? "#fff" : "var(--faint)",
                }}
              >
                {done ? "✓" : active ? "●" : ""}
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 18, background: done ? "var(--green)" : "var(--border-strong)" }} />
              )}
            </div>
            <span
              style={{
                fontSize: 12.5, paddingTop: 1, paddingBottom: 14,
                fontWeight: active ? 700 : 500,
                color: upcoming ? "var(--faint)" : "var(--ink)",
              }}
            >
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default BookingTimeline;
