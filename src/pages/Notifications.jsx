import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useNotifications } from "../hooks/useNotifications";
import { useSearch } from "../hooks/useSearch";
import Layout from "../components/Layout";
import Skeleton from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import FilterBar from "../components/common/FilterBar";
import { useTranslation } from "../hooks/useTranslation";
import { formatRelativeTime } from "../utils/formatRelativeTime";

const READ_OPTIONS = ["All", "Unread", "Read"];

function Notifications() {
  const { t } = useTranslation();
  const { notifications, loading, markAsRead, markAllRead } = useNotifications();
  const [searchParams] = useSearchParams();
  const [readFilter, setReadFilter] = useState("All");

  const { query, setQuery, results, isSearching } = useSearch(notifications, {
    keys: ["title", "body"],
    initialQuery: searchParams.get("q") || "",
  });

  const visible = useMemo(
    () => (readFilter === "All" ? results : results.filter((n) => (readFilter === "Unread" ? n.unread : !n.unread))),
    [results, readFilter]
  );

  const hasAnyUnread = notifications.some((n) => n.unread);

  return (
    <Layout title={t("notifications")}>
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search notifications..."
        filterValue={readFilter}
        onFilterChange={setReadFilter}
        filterOptions={READ_OPTIONS}
        isSearching={isSearching}
        totalCount={notifications.length}
        filteredCount={visible.length}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={markAllRead}
            disabled={!hasAnyUnread}
          >
            {t("markAllRead")}
          </button>
        }
      />

      {loading && <Skeleton variant="table" count={3} />}
      {!loading && visible.length === 0 && (
        <EmptyState
          icon="🔔"
          title={query || readFilter !== "All" ? "No matching notifications" : "No notifications yet"}
          message={query || readFilter !== "All" ? "Try a different search or filter." : "You're all caught up."}
        />
      )}

      {visible.map((n) => (
        <div
          key={n.id}
          className="stat-card"
          style={{
            marginBottom: 14,
            background: n.unread ? "var(--blue-soft)" : "var(--surface)",
            cursor: "pointer",
          }}
          onClick={() => markAsRead(n.id)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <strong>{n.title}</strong> {n.unread && <span className="badge active">New</span>}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
              {formatRelativeTime(n.timestamp)}
            </span>
          </div>
          <p style={{ margin: "6px 0 0 0", color: "var(--muted)", fontSize: 12 }}>{n.body}</p>
        </div>
      ))}
    </Layout>
  );
}

export default Notifications;
