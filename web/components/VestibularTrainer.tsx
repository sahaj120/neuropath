"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, OctagonX, Play } from "lucide-react";
import MagneticButton from "./MagneticButton";
import SpotlightCard from "./SpotlightCard";

type Pattern = "horizontal" | "vertical";

/**
 * Ocular-vestibular saccade trainer. Pacing comes strictly from the AI
 * (`saccadeSpeedMs` prop, no manual controls): the value feeds the motion
 * duration directly, and slow speeds automatically dim the target glow
 * to protect light-sensitive eyes.
 */
export default function VestibularTrainer({
  unlocked,
  speedMs,
  onSession,
}: {
  unlocked: boolean;
  speedMs: number;
  onSession?: (seconds: number) => void;
}) {
  const [pattern, setPattern] = useState<Pattern>("horizontal");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [vms, setVms] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!unlocked) {
      setRunning(false);
      setSeconds(0);
    }
  }, [unlocked]);

  if (!unlocked) {
    return (
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 10 },
          show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
        }}
        className="flex flex-col items-center rounded-2xl border border-white/5 bg-[#171717] p-8 text-center"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-neutral-500">
          <Lock size={16} />
        </span>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-400">
          Locked for safety: Your current dizziness levels require acoustic rest
          before visual training.
        </p>
      </motion.div>
    );
  }

  // AI-prescribed pacing, fed straight into the animation duration.
  const duration = speedMs / 1000;
  // Slow prescriptions dim the glow for light sensitivity.
  const glowClass = speedMs > 2500 ? "shadow-none" : "shadow-xl shadow-cyan-500/20";
  const paceLabel = speedMs > 2500 ? "Gentle pace · set for you" : "Steady pace · set for you";
  const mm = Math.floor(seconds / 60);
  const ss = (seconds % 60).toString().padStart(2, "0");

  const stopAndRest = () => {
    setRunning(false);
    if (seconds > 0) {
      setSessions((n) => n + 1);
      onSession?.(seconds);
    }
    setSeconds(0);
  };

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
          <p className="text-sm font-medium tracking-tight text-neutral-100">Eye training</p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
            Eyes only - keep your head still. {paceLabel}.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs tabular-nums text-neutral-400">
          {mm}:{ss}
          {sessions > 0 && <span className="text-neutral-600"> · {sessions} done</span>}
        </span>
      </div>

      {/* Visual Motion Sensitivity toggle */}
      <button
        onClick={() => setVms((v) => !v)}
        role="switch"
        aria-checked={vms}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/5 bg-[#0A0A0A] px-4 py-3 text-left"
      >
        <span>
          <span className="block text-xs font-medium text-neutral-200">
            Visual Motion Sensitivity
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-500">
            {vms ? "Dot rests · background drifts instead" : "Dot moves · background still"}
          </span>
        </span>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            vms ? "bg-neutral-100" : "bg-white/10"
          }`}
        >
          <motion.span
            className={`absolute top-0.5 h-5 w-5 rounded-full ${
              vms ? "bg-neutral-900" : "bg-neutral-400"
            }`}
            initial={false}
            animate={{ left: vms ? 22 : 2 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </span>
      </button>

      {/* Stage */}
      <div className="relative mt-4 flex h-56 items-center justify-center overflow-hidden rounded-xl bg-[#0A0A0A]">
        {/* VMS drift grid (pans when running in VMS mode) */}
        {vms ? (
          <motion.div
            className="absolute inset-y-0 -left-[10%] w-[120%]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
            initial={false}
            animate={running ? { x: [-26, 26, -26] } : { x: 0 }}
            transition={
              running
                ? { duration, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.4, ease: "easeOut" }
            }
          />
        ) : (
          <>
            <div className="absolute h-px w-3/4 bg-white/5" />
            <div className="absolute h-3/4 w-px bg-white/5" />
          </>
        )}
        <motion.span
          className={`relative h-4 w-4 rounded-full bg-neutral-100 ${glowClass}`}
          initial={false}
          animate={
            running && !vms
              ? pattern === "horizontal"
                ? { x: [-130, 130, -130], y: 0 }
                : { x: 0, y: [-80, 80, -80] }
              : { x: 0, y: 0 }
          }
          transition={
            running && !vms
              ? { duration, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.4, ease: "easeOut" }
          }
        />
        {!running && (
          <p className="absolute bottom-3 text-[11px] text-neutral-600">
            Press begin, then follow the glow
          </p>
        )}
      </div>

      {/* Direction */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["horizontal", "vertical"] as Pattern[]).map((p) => (
          <button
            key={p}
            onClick={() => setPattern(p)}
            className={`rounded-full px-4 py-2 text-xs font-medium capitalize transition ${
              pattern === p
                ? "bg-neutral-100 text-neutral-900"
                : "border border-white/10 text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Begin / Stop & Rest */}
      {!running ? (
        <MagneticButton
          onClick={() => setRunning(true)}
          ariaLabel="Begin eye training"
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
      {running && (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-neutral-600">
          Dizzy or nauseous? Stop immediately and rest.
        </p>
      )}
      </motion.div>
    </SpotlightCard>
  );
}
