import { useContext, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { useNotifications } from "../hooks/useNotifications";
import { useTranslation } from "../hooks/useTranslation";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import Avatar from "./Avatar";

const SEARCHABLE_LANDING_ROUTES = {
  customer: ["/customer/dashboard"],
  provider: ["/provider/dashboard"],
  admin: ["/admin/dashboard"],
};

const OWN_SEARCH_ROUTES = {
  customer: ["/customer/services", "/customer/booking-history", "/customer/notifications"],
  provider: ["/provider/services", "/provider/notifications"],
  admin: [
    "/admin/users",
    "/admin/bookings",
    "/admin/provider-approvals",
    "/admin/categories",
    "/admin/complaints",
    "/admin/notifications",
  ],
};

const SEARCH_DESTINATION = {
  customer: { path: "/customer/services", placeholder: "Search services..." },
  provider: { path: "/provider/services", placeholder: "Search your services..." },
  admin: { path: "/admin/users", placeholder: "Search users..." },
};

function Navbar({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { t } = useTranslation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const navRightRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (navRightRef.current && !navRightRef.current.contains(e.target)) {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const destination = SEARCH_DESTINATION[user?.role] || SEARCH_DESTINATION.customer;
  const ownSearchRoutes = OWN_SEARCH_ROUTES[user?.role] || [];
  const landingRoutes = SEARCHABLE_LANDING_ROUTES[user?.role] || [];
  const hasOwnSearch = ownSearchRoutes.some((route) => location.pathname.startsWith(route));
  const isSearchableLanding = landingRoutes.some((route) => location.pathname.startsWith(route));
  const showQuickJumpSearch = !hasOwnSearch && isSearchableLanding;

  useEffect(() => {
    setSearchValue("");
  }, [location.pathname]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    navigate(trimmed ? `${destination.path}?q=${encodeURIComponent(trimmed)}` : destination.path);
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <button className="navbar-hamburger" onClick={onMenuClick} aria-label="Open menu">
          ☰
        </button>
        <h2 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h2>
      </div>

      {showQuickJumpSearch && (
        <form onSubmit={handleSearchSubmit} className="search-box">
          <span style={{ opacity: 0.6 }}>🔍</span>
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={destination.placeholder}
            style={{ border: "none", background: "transparent", outline: "none", width: "100%", font: "inherit", color: "inherit" }}
          />
        </form>
      )}

      <div className="nav-right" ref={navRightRef}>
        {/* Theme Toggle */}
        <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? "🌙" : "☀️"}
        </button>

        {/* Notifications Dropdown Toggle */}
        <button
          className="icon-btn"
          style={{ position: "relative" }}
          onClick={() => {
            setProfileOpen(false);
            setNotifOpen((o) => !o);
          }}
          title="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#ef4444",
                color: "#fff",
                borderRadius: "50%",
                width: 16,
                height: 16,
                fontSize: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Panel */}
        {notifOpen && (
          <div className="dropdown-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h4 style={{ margin: 0 }}>Notifications</h4>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ padding: "3px 8px", fontSize: 10.5 }}
                  onClick={markAllRead}
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 && (
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "12px 0" }}>No notifications yet.</p>
            )}
            {notifications.slice(0, 4).map((n) => (
              <div
                key={n.id}
                className="dropdown-item"
                onClick={() => markAsRead(n.id)}
                style={{ cursor: "pointer", opacity: n.unread ? 1 : 0.6 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div className="title">{n.title}</div>
                  <span style={{ fontSize: 9.5, color: "var(--faint)", whiteSpace: "nowrap" }}>
                    {formatRelativeTime(n.timestamp)}
                  </span>
                </div>
                <div className="body">{n.body}</div>
              </div>
            ))}
            {notifications.length > 0 && (
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%", marginTop: 6, fontSize: 11, fontWeight: 600, color: "var(--blue)" }}
                onClick={() => {
                  setNotifOpen(false);
                  navigate(`/${user?.role}/notifications`);
                }}
              >
                View all notifications
              </button>
            )}
          </div>
        )}

        {/* User Profile Dropdown Trigger */}
        <div
          onClick={() => {
            setNotifOpen(false);
            setProfileOpen((p) => !p);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: 10,
            transition: "background 0.15s ease",
            userSelect: "none",
          }}
          className="user-profile-trigger"
          title="Account Menu"
        >
          <div className="avatar" style={{ overflow: "hidden", padding: 0 }}>
            <Avatar user={user} size={32} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", gap: 4 }}>
              {user?.name || "Guest"}
              <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "capitalize" }}>
              {user?.role || ""}
            </div>
          </div>
        </div>

        {/* User Profile Dropdown Menu */}
        {profileOpen && (
          <div
            className="dropdown-panel"
            style={{
              width: 200,
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.email}
              </div>
            </div>

            <Link
              to={`/${user?.role}/profile`}
              className="dropdown-item"
              onClick={() => setProfileOpen(false)}
              style={{ textDecoration: "none", padding: "8px 10px", borderRadius: 8 }}
            >
              👤 My Profile
            </Link>

            <Link
              to={`/${user?.role}/settings`}
              className="dropdown-item"
              onClick={() => setProfileOpen(false)}
              style={{ textDecoration: "none", padding: "8px 10px", borderRadius: 8 }}
            >
              ⚙️ Settings
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="dropdown-item"
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                color: "#ef4444",
                fontWeight: 600,
                padding: "8px 10px",
                borderRadius: 8,
                cursor: "pointer",
                borderTop: "1px solid var(--border)",
                marginTop: 4,
                paddingTop: 8,
              }}
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
