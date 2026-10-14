import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./SettingsShell.css";

/**
 * Modern Settings Hub & Card View Component
 *
 * sections: [
 *   {
 *     id: "account",
 *     title: "Account",
 *     icon: "👤",
 *     items: [
 *       { id, title, description, icon, color, content, isDanger, onAction }
 *     ]
 *   }
 * ]
 */
function SettingsShell({ sections = [], defaultView = null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get("view") || searchParams.get("tab") || defaultView;
  const [activeId, setActiveId] = useState(initialView || null);

  useEffect(() => {
    const viewParam = searchParams.get("view") || searchParams.get("tab");
    if (viewParam) {
      setActiveId(viewParam);
    }
  }, [searchParams]);

  // Find currently active item if any
  let activeItem = null;
  for (const sec of sections) {
    const found = sec.items.find((i) => i.id === activeId);
    if (found) {
      activeItem = { ...found, sectionTitle: sec.title };
      break;
    }
  }

  const handleSelect = (item) => {
    if (item.onAction) {
      item.onAction();
      return;
    }
    setActiveId(item.id);
    setSearchParams({ view: item.id });
  };

  const handleBack = () => {
    setActiveId(null);
    setSearchParams({});
  };

  return (
    <div className="settings-hub-container">
      <AnimatePresence mode="wait">
        {activeItem ? (
          /* ---------------- DETAIL VIEW ---------------- */
          <motion.div
            key={activeItem.id}
            className="settings-detail-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <button type="button" className="settings-back-btn" onClick={handleBack}>
              ← Back to Settings
            </button>

            <div className="settings-detail-header">
              <div className={`settings-icon-circle ${activeItem.color || "blue"}`}>
                {activeItem.icon}
              </div>
              <div>
                <h3>{activeItem.title}</h3>
                <p>{activeItem.description}</p>
              </div>
            </div>

            <div className="settings-detail-body">{activeItem.content}</div>
          </motion.div>
        ) : (
          /* ---------------- HUB GRID VIEW ---------------- */
          <motion.div
            key="hub-overview"
            className="settings-hub-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {sections.map((section) => {
              if (section.isDanger) {
                // Danger Zone Section (wide special card)
                const dangerItem = section.items[0];
                return (
                  <div key={section.id} className="settings-section-group">
                    <h3 className="settings-section-title" style={{ color: "#f87171" }}>
                      <span className="section-icon">⚠️</span>
                      {section.title}
                    </h3>

                    {dangerItem && (
                      <div className="settings-danger-card">
                        <div className="settings-hub-card-left">
                          <div className={`settings-icon-circle ${dangerItem.color || "red"}`}>
                            {dangerItem.icon}
                          </div>
                          <div className="settings-card-text">
                            <strong className="settings-card-title">{dangerItem.title}</strong>
                            <p className="settings-card-desc">{dangerItem.description}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="settings-danger-btn"
                          onClick={() => handleSelect(dangerItem)}
                        >
                          {dangerItem.actionLabel || dangerItem.title} &gt;
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={section.id} className="settings-section-group">
                  <h3 className="settings-section-title">
                    <span className="section-icon">{section.icon}</span>
                    {section.title}
                  </h3>

                  <div className="settings-cards-grid">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="settings-hub-card"
                        onClick={() => handleSelect(item)}
                      >
                        <div className="settings-hub-card-left">
                          <div className={`settings-icon-circle ${item.color || "blue"}`}>
                            {item.icon}
                          </div>
                          <div className="settings-card-text">
                            <strong className="settings-card-title">{item.title}</strong>
                            <p className="settings-card-desc">{item.description}</p>
                          </div>
                        </div>
                        <span className="settings-chevron-icon">&gt;</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SettingsShell;
