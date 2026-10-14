import { Link } from "react-router-dom";

export function SectionCard({ title, description, children, style }) {
  return (
    <div className="stat-card" style={{ marginBottom: 20, ...style }}>
      {title && <h4 style={{ marginTop: 0, marginBottom: description ? 4 : 14 }}>{title}</h4>}
      {description && <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>{description}</p>}
      {children}
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer",
      }}
    >
      <span>
        <div style={{ fontSize: 13 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{hint}</div>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function FieldRow({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

// A card that just points to a full page elsewhere in the app (e.g. Manage
// Users, Reports) instead of re-implementing that page's whole CRUD table
// inside a settings tab — Settings holds the *configuration* for that area,
// the dedicated page still owns the actual day-to-day management UI.
export function LinkCard({ to, icon, title, description }) {
  return (
    <Link
      to={to}
      className="stat-card"
      style={{
        display: "flex", gap: 14, alignItems: "center", textDecoration: "none",
        color: "inherit", marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{description}</div>
      </div>
      <div style={{ color: "var(--faint)", fontSize: 16 }}>→</div>
    </Link>
  );
}

export function SavedHint({ show }) {
  if (!show) return null;
  return <span style={{ marginLeft: 12, color: "var(--green)", fontSize: 12 }}>Saved!</span>;
}
