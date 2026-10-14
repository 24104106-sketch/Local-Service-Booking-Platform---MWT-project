import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

function Layout({ title, children }) {
  const isOnline = useOnlineStatus();
  const location = useLocation();
  // Mobile drawer state lives here (not in Sidebar) because both Sidebar
  // (to render open/closed) and Navbar (to trigger the hamburger) need it.
  // No effect on desktop — the CSS that reads .sidebar--open is entirely
  // scoped inside the <=900px media query.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer automatically on every navigation, so it never stays
  // open over the new page after tapping a menu link.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div
        className={`sidebar-drawer-overlay ${drawerOpen ? "sidebar-drawer-overlay--visible" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Navbar title={title} onMenuClick={() => setDrawerOpen(true)} />
        {!isOnline && (
          <div
            style={{
              background: "var(--red-bg)",
              color: "var(--red)",
              textAlign: "center",
              padding: "8px 16px",
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            ⚠️ You're offline — some actions like booking or payment may not work until your connection is restored.
          </div>
        )}
        {/* AnimatePresence + a location-keyed motion.div gives every route
            change a subtle fade/slide instead of an abrupt content swap —
            applies to every page automatically since they all render inside Layout. */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            className="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Layout;
