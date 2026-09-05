"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Magnetic CTA wrapper: the button leans toward the cursor with soft spring
 * physics (stiffness 150, damping 15) and settles back on leave.
 */
export default function MagneticButton({
  children,
  onClick,
  disabled = false,
  className = "",
  ariaLabel,
  fit = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  fit?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState({ x: 0, y: 0 });

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el || disabled) return;
        const r = el.getBoundingClientRect();
        setPull({
          x: (e.clientX - (r.left + r.width / 2)) * 0.16,
          y: (e.clientY - (r.top + r.height / 2)) * 0.16,
        });
      }}
      onMouseLeave={() => setPull({ x: 0, y: 0 })}
      initial={false}
      animate={{ x: pull.x, y: pull.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
      className={fit ? "w-fit" : "w-full"}
    >
      <motion.button
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={className}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}
