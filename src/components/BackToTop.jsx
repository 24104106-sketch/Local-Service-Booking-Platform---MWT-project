import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 600);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          onClick={scrollToTop}
          aria-label="Back to top"
          initial={{ opacity: 0, y: 16, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          style={{
            position: "fixed", bottom: 28, right: 28, zIndex: 900,
            width: 46, height: 46, borderRadius: "50%", border: "none",
            background: "var(--blue)", color: "#fff", fontSize: 18,
            cursor: "pointer", boxShadow: "var(--shadow-lg)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ↑
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default BackToTop;
