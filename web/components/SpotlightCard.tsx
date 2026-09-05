"use client";

import { useState } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";

/**
 * Matte glass card with a cursor-tracking spotlight: a soft inner glow plus
 * a 1px bright border that follows the pointer. Rendered with motion values
 * so tracking stays at 60fps without re-rendering the card.
 */
export default function SpotlightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const mx = useMotionValue(-500);
  const my = useMotionValue(-500);
  const [lit, setLit] = useState(false);

  const glow = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, rgba(255,255,255,0.09), transparent 65%)`;
  const edge = useMotionTemplate`radial-gradient(240px circle at ${mx}px ${my}px, rgba(255,255,255,0.28), transparent 60%)`;

  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseEnter={() => setLit(true)}
      onMouseLeave={() => {
        setLit(false);
        mx.set(-500);
        my.set(-500);
      }}
      className={`relative overflow-hidden rounded-2xl border-[0.5px] border-white/10 bg-[#171717]/70 backdrop-blur-xl ${className}`}
    >
      {/* soft inner glow */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: glow }}
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
      {/* 1px spotlight border */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: edge,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: 1,
        }}
        initial={false}
        animate={{ opacity: lit ? 1 : 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
