import { memo } from "react";

// React.memo — Badge renders once per row across every DataTable (8+ pages),
// re-rendering only when its own `status` prop actually changes.
function Badge({ status }) {
  // Strip ALL whitespace (not just lowercase) so multi-word statuses like
  // "In Review" become a single "inreview" class instead of two unintended
  // classes ("in" and "review") that match no CSS rule and render unstyled.
  const kind = (status || "").toLowerCase().replace(/\s+/g, "");
  return <span className={`badge ${kind}`}>{status}</span>;
}

export default memo(Badge);
