"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

/**
 * Global sensory overlay for light sensitivity. The tint is decided in code
 * (never by model output): warm amber when symptoms run high, otherwise off.
 * A manual override keeps the person in control at all times.
 */
export default function PhotophobiaGuard({ tint }: { tint: "amber" | "none" }) {
  const [off, setOff] = useState(false);

  // A fresh session re-engages the filter.
  useEffect(() => {
    setOff(false);
  }, [tint]);

  if (tint === "none") return null;

  return (
    <>
      {!off && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[80] bg-amber-950/20"
          style={{ mixBlendMode: "multiply" }}
        />
      )}
      {!off && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[80]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,176,66,0.08), rgba(255,140,40,0.12))",
          }}
        />
      )}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setOff((v) => !v)}
        className="fixed bottom-14 right-5 z-[90] flex items-center gap-2 rounded-full border border-white/10 bg-black/60 py-2 pl-3 pr-4 text-xs text-neutral-300 backdrop-blur-xl transition hover:bg-black/80 active:scale-95"
        aria-label={off ? "Turn the screen filter back on" : "Turn the screen filter off"}
      >
        {off ? <Eye size={13} /> : <EyeOff size={13} />}
        {off ? "Filter off" : "Warm filter on"}
      </motion.button>
    </>
  );
}
