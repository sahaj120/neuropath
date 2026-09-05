"use client";

import { motion, type Variants } from "framer-motion";

/**
 * Kinetic typography: splits text into characters that cascade in on a
 * high-tension spring, like a premium motion-graphics title card.
 */
const word: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.022, delayChildren: 0.05 } },
};

const glyph: Variants = {
  hidden: { opacity: 0, y: 14, rotateX: 40 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: "spring", stiffness: 200, damping: 10 },
  },
};

export default function KineticText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <motion.span
      key={text}
      variants={word}
      initial="hidden"
      animate="show"
      className={`inline-block ${className}`}
      aria-label={text}
    >
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          variants={glyph}
          className="inline-block will-change-transform"
          aria-hidden="true"
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}
