import { motion, useScroll, useSpring } from "framer-motion";

// useScroll gives 0→1 raw scroll progress; useSpring smooths it so the bar
// doesn't feel jittery on trackpads/fast scrolling. Purely visual — no
// state, no re-renders, framer-motion drives the transform directly.
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, var(--blue), #a855f7)",
        transformOrigin: "0%", scaleX, zIndex: 2000,
      }}
    />
  );
}

export default ScrollProgress;
