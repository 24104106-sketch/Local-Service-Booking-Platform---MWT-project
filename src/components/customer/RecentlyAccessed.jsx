import React from "react";
import { useNavigate } from "react-router-dom";
import { useRecentlyAccessed } from "../../hooks/useRecentlyAccessed";
import { useTranslation } from "../../hooks/useTranslation";
import { formatCurrency } from "../../utils/currency";
import Skeleton from "../Skeleton";

// Helper to format relative time
function formatRelativeTime(dateString, t) {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return t("justNow") || "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}${t("minutesAgo") || "m ago"}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}${t("hoursAgo") || "h ago"}`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}${t("daysAgo") || "d ago"}`;
}

export default function RecentlyAccessed({ limit = 6, showHeader = true, className = "" }) {
  const { items, loading, error, clearHistory, refresh } = useRecentlyAccessed(limit);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleItemClick = (item) => {
    if (item.itemType === "service" && item.service) {
      navigate(`/customer/services/${item.service.id}`, { state: { service: item.service } });
    } else if (item.itemType === "provider" && item.provider) {
      const providerName = encodeURIComponent(item.provider.businessName || item.provider.name);
      navigate(`/customer/providers/${providerName}`);
    }
  };

  return (
    <div className={`recently-accessed-container ${className}`} style={{ margin: "24px 0" }}>
      {showHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🕒</span>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--ink)" }}>
                {t("recentlyAccessed") || "Recently Viewed"}
              </h3>
            </div>
            <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
              {t("recentlyAccessedSubtitle") || "Jump back to services and providers you recently explored"}
            </p>
          </div>

          {items && items.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="btn-ghost"
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "4px 10px",
                borderRadius: "6px",
                background: "transparent",
                border: "1px solid var(--border)",
              }}
              title="Clear recently viewed history"
            >
              {t("clearRecent") || "Clear History"}
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} variant="card" height={130} />
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          style={{
            padding: "16px",
            borderRadius: "var(--radius)",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "var(--red)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
          }}
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={refresh}
            style={{ padding: "4px 10px", fontSize: "12px" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && (!items || items.length === 0) && (
        <div
          style={{
            padding: "24px 20px",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--blue-soft)",
              color: "var(--blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🔍
          </div>
          <strong style={{ fontSize: "14px", color: "var(--ink)" }}>
            {t("noRecentItems") || "No recently viewed items yet"}
          </strong>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", maxWidth: "340px" }}>
            {t("noRecentItemsSub") || "Browse services or view providers to keep quick shortcuts here."}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            style={{ marginTop: "6px", fontSize: "12.5px" }}
            onClick={() => navigate("/customer/services")}
          >
            {t("browseServices") || "Browse Services"}
          </button>
        </div>
      )}

      {/* Populated Items Grid */}
      {!loading && !error && items && items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "14px",
          }}
        >
          {items.map((item) => {
            const isService = item.itemType === "service" && item.service;
            const isProvider = item.itemType === "provider" && item.provider;
            if (!isService && !isProvider) return null;

            const title = isService
              ? item.service.title
              : item.provider.businessName || item.provider.name;
            const category = isService ? item.service.category : item.provider.category;
            const timeAgo = formatRelativeTime(item.accessedAt, t);

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleItemClick(item);
                }}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "16px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  boxShadow: "var(--shadow-sm)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  e.currentTarget.style.borderColor = "var(--blue)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        padding: "3px 8px",
                        borderRadius: "9999px",
                        background: isService ? "rgba(37, 99, 235, 0.1)" : "rgba(16, 185, 129, 0.1)",
                        color: isService ? "var(--blue)" : "#059669",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span>{isService ? "🛠️" : "👤"}</span>
                      {isService ? t("serviceItem") || "Service" : t("providerItem") || "Provider"}
                    </span>

                    {timeAgo && (
                      <span style={{ fontSize: "11px", color: "var(--faint)" }}>
                        {timeAgo}
                      </span>
                    )}
                  </div>

                  <h4
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: "14.5px",
                      fontWeight: 700,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={title}
                  >
                    {title}
                  </h4>

                  <p
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "12px",
                      color: "var(--muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>📁</span>
                    <span>{category || "General"}</span>
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--border)",
                    marginTop: "4px",
                  }}
                >
                  <div>
                    {isService && item.service.price != null && (
                      <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--ink)" }}>
                        {formatCurrency(item.service.price)}
                      </span>
                    )}
                    {isProvider && (
                      <span style={{ fontSize: "12px", color: "#eab308", fontWeight: 700 }}>
                        ★ {item.provider.rating ? Number(item.provider.rating).toFixed(1) : "New"}
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--blue)",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {isService ? t("viewService") || "View Service" : t("viewProvider") || "View Provider"} →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
