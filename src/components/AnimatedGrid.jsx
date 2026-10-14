import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

/**
 * Wraps a set of stat cards (or any children) with a staggered fade/slide-up
 * entrance animation. Reused across all three dashboards instead of
 * duplicating Framer Motion boilerplate in each one.
 */
function AnimatedGrid({ children, className = "stat-grid" }) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {items.map((child, i) => (
        <motion.div key={i} variants={item}>{child}</motion.div>
      ))}
    </motion.div>
  );
}

export default AnimatedGrid;
