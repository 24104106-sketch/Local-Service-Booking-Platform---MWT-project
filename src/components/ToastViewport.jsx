import { useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ToastContext } from "../context/ToastContext";

const ICONS = { success: "✅", error: "⚠️", info: "ℹ️" };
const ACCENTS = { success: "var(--green)", error: "var(--red)", info: "var(--blue)" };

function ToastViewport() {
  const { toasts, dismissToast } = useContext(ToastContext);

  return (
    <div
      style={{
        position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column",
        gap: 10, zIndex: 999, pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={() => dismissToast(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12,
              background: "var(--surface)", border: `1px solid ${ACCENTS[t.type] || ACCENTS.info}`,
              boxShadow: "var(--shadow-lg)", cursor: "pointer", minWidth: 260, maxWidth: 360,
              fontSize: 13, color: "var(--ink)", backdropFilter: "blur(10px)", pointerEvents: "auto",
            }}
          >
            <span>{ICONS[t.type] || ICONS.info}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ToastViewport;
