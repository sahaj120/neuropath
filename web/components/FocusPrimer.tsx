"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import MagneticButton from "./MagneticButton";
import SpotlightCard from "./SpotlightCard";

type Phase = "task" | "micro" | "timer" | "done";

/**
 * Executive-function primer for ADHD paralysis: name the avoided task,
 * shrink it to a 1-minute first step, then a giant 60-second countdown
 * fires the starting gun. Starting is the whole trick.
 */
export default function FocusPrimer() {
  const [phase, setPhase] = useState<Phase>("task");
  const [task, setTask] = useState("");
  const [micro, setMicro] = useState("");
  const [left, setLeft] = useState(60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (left <= 0) {
      setRunning(false);
      setPhase("done");
      return;
    }
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [running, left]);

  const restart = () => {
    setTask("");
    setMicro("");
    setLeft(60);
    setRunning(false);
    setPhase("task");
  };

  const mm = Math.floor(left / 60);
  const ss = (left % 60).toString().padStart(2, "0");

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 10 },
          show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
        }}
      >
      <p className="text-sm font-medium tracking-tight text-neutral-100">One small start</p>
      <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
        For the frozen, heavy feeling. Sixty seconds is all we ask.
      </p>

      <AnimatePresence mode="wait">
        {phase === "task" && (
          <motion.div
            key="fp-task"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="pt-5"
          >
            <p className="text-[15px] font-medium leading-snug text-neutral-100">
              What is the one task you are avoiding?
            </p>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Say it plainly…"
              maxLength={120}
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-700 focus:border-white/25"
            />
            <MagneticButton
              onClick={() => task.trim() && setPhase("micro")}
              disabled={!task.trim()}
              ariaLabel="Continue to first step"
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium transition ${
                task.trim()
                  ? "bg-neutral-100 text-neutral-900 hover:bg-white"
                  : "cursor-not-allowed bg-white/5 text-neutral-600"
              }`}
            >
              Next <ArrowRight size={14} />
            </MagneticButton>
          </motion.div>
        )}

        {phase === "micro" && (
          <motion.div
            key="fp-micro"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="pt-5"
          >
            <p className="text-[15px] font-medium leading-snug text-neutral-100">
              What is the absolute smallest, 1-minute step you can take to start?
            </p>
            <p className="mt-1.5 truncate text-xs text-neutral-500">
              Toward: {task.trim()}
            </p>
            <input
              value={micro}
              onChange={(e) => setMicro(e.target.value)}
              placeholder="e.g. Open the document. Put on shoes. Fill one glass…"
              maxLength={140}
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#0A0A0A] px-4 py-3.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-700 focus:border-white/25"
            />
            <MagneticButton
              onClick={() => {
                if (!micro.trim()) return;
                setLeft(60);
                setRunning(true);
                setPhase("timer");
              }}
              disabled={!micro.trim()}
              ariaLabel="Start 60 second timer"
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-medium transition ${
                micro.trim()
                  ? "bg-neutral-100 text-neutral-900 hover:bg-white"
                  : "cursor-not-allowed bg-white/5 text-neutral-600"
              }`}
            >
              <Play size={14} fill="currentColor" /> Start 60 seconds
            </MagneticButton>
          </motion.div>
        )}

        {phase === "timer" && (
          <motion.div
            key="fp-timer"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="pt-6 text-center"
          >
            <p className="truncate text-xs text-neutral-500">Doing: {micro.trim()}</p>
            <p className="mt-3 text-7xl font-medium tabular-nums tracking-tight text-neutral-100 sm:text-8xl">
              {mm}:{ss}
            </p>
            <div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-neutral-200"
                initial={false}
                animate={{ width: `${((60 - left) / 60) * 100}%` }}
                transition={{ duration: 0.5, ease: "linear" }}
              />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                onClick={() => setRunning((r) => !r)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 transition hover:bg-white active:scale-95"
                aria-label={running ? "Pause timer" : "Resume timer"}
              >
                {running ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                onClick={() => {
                  setLeft(60);
                  setRunning(false);
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200 active:scale-95"
                aria-label="Reset timer"
              >
                <RotateCcw size={15} />
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">
              Just the tiny step. Nothing more counts.
            </p>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div
            key="fp-done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="py-6 text-center"
          >
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/10 text-lg text-emerald-300">
              ✓
            </span>
            <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-neutral-200">
              You started - that&apos;s the whole trick. Keep going, or rest on
              the win.
            </p>
            <button
              onClick={restart}
              className="mx-auto mt-4 flex items-center gap-2 text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-300 hover:underline"
            >
              <RotateCcw size={13} /> Prime another task
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </SpotlightCard>
  );
}
