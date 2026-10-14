import { useRef, useLayoutEffect } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import { useNotifications } from "../hooks/useNotifications";
import { useChat } from "../hooks/useChat";

const MENUS = {
  customer: [
    { to: "/customer/dashboard", labelKey: "dashboard", icon: "🏠" },
    { to: "/customer/services", labelKey: "browseServices", icon: "🧰" },
    { to: "/customer/booking-history", labelKey: "bookingHistory", icon: "📅" },
    { to: "/customer/messages", labelKey: "messages", icon: "✉️", badgeKey: "messages" },
    { to: "/customer/wallet", labelKey: "wallet", icon: "💳" },
    { to: "/customer/support", labelKey: "support", icon: "❓" },
    { to: "/customer/notifications", labelKey: "notifications", icon: "🔔", badgeKey: "notifications" },
    { to: "/customer/profile", labelKey: "profile", icon: "👤" },
    { to: "/customer/settings", labelKey: "settings", icon: "⚙️" },
  ],
  provider: [
    { to: "/provider/dashboard", labelKey: "dashboard", icon: "🏠" },
    { to: "/provider/services", labelKey: "manageServices", icon: "🧰" },
    { to: "/provider/availability", labelKey: "availability", icon: "🕒" },
    { to: "/provider/earnings", labelKey: "earnings", icon: "💵" },
    { to: "/provider/reviews", labelKey: "myReviews", icon: "⭐" },
    { to: "/provider/messages", labelKey: "messages", icon: "✉️", badgeKey: "messages" },
    { to: "/provider/notifications", labelKey: "notifications", icon: "🔔", badgeKey: "notifications" },
    { to: "/provider/profile", labelKey: "profile", icon: "👤" },
    { to: "/provider/settings", labelKey: "settings", icon: "⚙️" },
  ],
  admin: [
    { to: "/admin/dashboard", labelKey: "dashboard", icon: "🏠" },
    { to: "/admin/users", labelKey: "manageUsers", icon: "👥" },
    { to: "/admin/bookings", labelKey: "allBookings", icon: "📅" },
    { to: "/admin/provider-approvals", labelKey: "providerApprovals", icon: "🛡️" },
    { to: "/admin/communities", labelKey: "manageCommunities", icon: "🏢" },
    { to: "/admin/categories", labelKey: "manageCategories", icon: "🗂️" },
    { to: "/admin/complaints", labelKey: "complaints", icon: "📢" },
    { to: "/admin/reports", labelKey: "reports", icon: "📊" },
    { to: "/admin/payments", labelKey: "payments", icon: "💰" },
    { to: "/admin/system-logs", labelKey: "systemLogs", icon: "🧾" },
    { to: "/admin/notifications", labelKey: "notifications", icon: "🔔", badgeKey: "notifications" },
    { to: "/admin/profile", labelKey: "profile", icon: "👤" },
    { to: "/admin/settings", labelKey: "settings", icon: "⚙️" },
  ],
};

function Sidebar({ open = false, onClose }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { unreadCount: notifCount } = useNotifications();
  const { totalUnreadCount: chatCount } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const menu = MENUS[user?.role] || MENUS.customer;
  const navRef = useRef(null);

  useLayoutEffect(() => {
    const activeLink = navRef.current?.querySelector(".active");
    if (typeof activeLink?.scrollIntoView === "function") {
      activeLink.scrollIntoView({ block: "nearest" });
    }
  }, [location.pathname]);

  const handleLogout = () => {
    onClose?.();
    logout();
    navigate("/login");
  };

  const supportLink =
    user?.role === "provider"
      ? "/provider/settings?view=help"
      : "/customer/support";

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="sidebar-logo">
        <div className="box">🔧</div>
        <div>
          <h1>{t("appName")}</h1>
          <span>{user?.role ? `${user.role} ${t("servicePanel")}` : "Service Booking"}</span>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
          ✕
        </button>
      </div>

      <nav ref={navRef} onClick={onClose}>
        {menu.map((item) => {
          let badge = 0;
          if (item.badgeKey === "notifications") badge = notifCount;
          if (item.badgeKey === "messages") badge = chatCount;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-text">{t(item.labelKey)}</span>
              {badge > 0 && (
                <span className="sidebar-badge-count">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Dedicated Sidebar Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="sidebar-logout-btn"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            marginTop: 6,
            borderRadius: 10,
            color: "#f87171",
            textDecoration: "none",
            fontSize: "13.5px",
            fontWeight: 600,
            border: "none",
            background: "none",
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <span className="sidebar-link-icon">🚪</span>
          <span className="sidebar-link-text">Logout</span>
        </button>
      </nav>

      {/* Role-Specific Bottom Widget */}
      {user?.role === "admin" ? (
        <div
          className="sidebar-help-card"
          style={{
            background: "rgba(15, 23, 42, 0.75)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
                boxShadow: "0 0 8px #22c55e",
              }}
            />
            <h4
              style={{
                margin: 0,
                fontSize: 11,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              System Health
            </h4>
          </div>
          <p style={{ fontSize: 12, color: "#ffffff", fontWeight: 700, margin: "2px 0 10px 0" }}>
            🟢 All Services Active
          </p>
          <Link
            to="/admin/system-logs"
            className="sidebar-help-btn"
            onClick={onClose}
            style={{ fontSize: 11.5, padding: "6px 12px", textAlign: "center" }}
          >
            View System Logs →
          </Link>
        </div>
      ) : (
        <div className="sidebar-help-card">
          <h4>Need Help?</h4>
          <p>We're here to help you 24/7. Reach out anytime.</p>
          <Link to={supportLink} className="sidebar-help-btn" onClick={onClose}>
            Contact Support →
          </Link>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
