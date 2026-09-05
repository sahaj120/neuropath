"use client";

import { motion } from "framer-motion";

/**
 * Global aurora canvas: massive blurred orbs drifting in a slow endless loop.
 * Colors arrive as props so the whole atmosphere follows the AI triage state.
 */
const ORBS = [
  { size: 560, left: "-8%", top: "-12%", duration: 28, dx: [0, 60, -20, 0], dy: [0, 40, 80, 0] },
  { size: 640, left: "55%", top: "-20%", duration: 34, dx: [0, -70, -30, 0], dy: [0, 60, 20, 0] },
  { size: 520, left: "20%", top: "55%", duration: 30, dx: [0, 50, 90, 0], dy: [0, -50, -10, 0] },
  { size: 460, left: "70%", top: "60%", duration: 24, dx: [0, -40, 30, 0], dy: [0, -60, -30, 0] },
];

export default function AuroraBackground({ colors }: { colors: string[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      {ORBS.map((orb, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full blur-[120px]"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.left,
            top: orb.top,
            background: colors[i % colors.length] ?? "transparent",
          }}
          initial={false}
          animate={{ x: orb.dx, y: orb.dy }}
          transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
