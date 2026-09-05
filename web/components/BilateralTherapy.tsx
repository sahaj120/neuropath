"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { OctagonX, Play } from "lucide-react";
import MagneticButton from "./MagneticButton";
import SpotlightCard from "./SpotlightCard";

/**
 * Bilateral visual stimulation for anxiety and panic down-regulation.
 * A soft orb glides far-left to far-right; paced in Hz, eyes only.
 */
export default function BilateralTherapy() {
  const [running, setRunning] = useState(false);
  const [hz, setHz] = useState(0.5);
  const [seconds, setSeconds] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [amp, setAmp] = useState(130);
  const trackRef = useRef<HTMLDivElement>(null);

  /* Measure glide amplitude from the live track width */
  useLayoutEffect(() => {
    const measure = () => {
      const w = trackRef.current?.offsetWidth ?? 320;
      setAmp(Math.max(w / 2 - 26, 60));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const stopAndRest = () => {
    setRunning(false);
    if (seconds > 0) setSessions((n) => n + 1);
    setSeconds(0);
  };

  const mm = Math.floor(seconds / 60);
  const ss = (seconds % 60).toString().padStart(2, "0");
  const pct = ((hz - 0.25) / (1 - 0.25)) * 100;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 10 },
          show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
        }}
      >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-tight text-neutral-100">
            Bilateral light
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
            Follow the light with your eyes. Keep your head still.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs tabular-nums text-neutral-400">
          {mm}:{ss}
          {sessions > 0 && <span className="text-neutral-600"> · {sessions} done</span>}
        </span>
      </div>

      {/* Stage - far left to far right */}
      <div
        ref={trackRef}
        className="relative mt-4 flex h-36 items-center justify-center overflow-hidden rounded-xl bg-[#0A0A0A]"
      >
        <div className="absolute h-px w-full bg-white/5" />
        <motion.span
          className="h-5 w-5 rounded-full bg-neutral-100 shadow-[0_0_32px_rgba(255,255,255,0.5)]"
          initial={false}
          animate={running ? { x: [-amp, amp, -amp] } : { x: 0 }}
          transition={
            running
              ? { duration: 1 / hz, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.4, ease: "easeOut" }
          }
        />
        {!running && (
          <p className="absolute bottom-3 text-[11px] text-neutral-600">
            Press begin, then let your eyes ride the glow
          </p>
        )}
      </div>

      {/* Speed (Hz) */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-neutral-400">Speed</span>
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs tabular-nums text-neutral-400">
            {hz.toFixed(2)} Hz
          </span>
        </div>
        <div className="relative flex h-8 items-center">
          <div className="h-[3px] w-full rounded-full bg-white/10">
            <div className="h-full rounded-full bg-neutral-200" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute h-3 w-3 rounded-full bg-neutral-100 shadow-[0_0_12px_rgba(255,255,255,0.45)]"
            style={{ left: `calc(${pct}% - 6px)` }}
          />
          <input
            type="range"
            min={0.25}
            max={1}
            step={0.05}
            value={hz}
            aria-label="Oscillation speed in hertz"
            onChange={(e) => setHz(Number(e.target.value))}
            className="np-native-hide absolute inset-0 h-full w-full cursor-pointer"
          />
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
          Slower soothes · faster engages. Settle where your body softens.
        </p>
      </div>

      {!running ? (
        <MagneticButton
          onClick={() => setRunning(true)}
          ariaLabel="Begin bilateral session"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-100 py-3.5 text-sm font-medium text-neutral-900 transition hover:bg-white"
        >
          <Play size={15} fill="currentColor" /> Begin
        </MagneticButton>
      ) : (
        <MagneticButton
          onClick={stopAndRest}
          ariaLabel="Stop and rest"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 py-3.5 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
        >
          <OctagonX size={15} /> Stop &amp; Rest
        </MagneticButton>
      )}
      </motion.div>
    </SpotlightCard>
  );
}
