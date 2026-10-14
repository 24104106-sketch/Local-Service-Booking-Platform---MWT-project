const shimmerStyle = {
  background: "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 50%, var(--skeleton-base) 75%)",
  backgroundSize: "200% 100%",
  animation: "skeleton-shimmer 1.4s ease-in-out infinite",
  borderRadius: 10,
};

/**
 * Reusable skeleton placeholder shown while data is loading, instead of
 * plain "Loading..." text. Three variants cover every loading state in the app:
 * - "line"  — one or more text-line placeholders (default)
 * - "card"  — a row of stat-card-shaped placeholders (dashboards)
 * - "table" — stacked full-width row placeholders (lists/tables)
 */
function Skeleton({ variant = "line", count = 1, height, width, style }) {
  const items = Array.from({ length: count });

  if (variant === "card") {
    return (
      <div className="stat-grid">
        {items.map((_, i) => (
          <div key={i} className="stat-card" style={{ ...shimmerStyle, height: height || 92 }} />
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((_, i) => (
          <div key={i} style={{ ...shimmerStyle, height: height || 46, width: "100%" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((_, i) => (
        <div key={i} style={{ ...shimmerStyle, height: height || 14, width: width || "100%", ...style }} />
      ))}
    </div>
  );
}

export default Skeleton;
