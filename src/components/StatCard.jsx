import { memo } from "react";

// React.memo — skips re-rendering this component if its props haven't changed.
// Useful here because dashboards render 4 of these side by side.
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="icon-box">{icon}</div>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export default memo(StatCard);
