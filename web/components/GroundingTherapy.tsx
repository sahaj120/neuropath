"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import MagneticButton from "./MagneticButton";
import SpotlightCard from "./SpotlightCard";

type GroundStep = { sense: string; count: number; prompt: string };

const STEPS: GroundStep[] = [
  { sense: "see", count: 5, prompt: "Acknowledge 5 things you can see around you." },
  { sense: "touch", count: 4, prompt: "Acknowledge 4 things you can touch." },
  { sense: "hear", count: 3, prompt: "Acknowledge 3 things you can hear." },
  { sense: "smell", count: 2, prompt: "Acknowledge 2 things you can smell." },
  { sense: "taste", count: 1, prompt: "Acknowledge 1 thing you can taste." },
];

/**
 * 5-4-3-2-1 grounding protocol for dissociation and acute anxiety.
 * Each step unlocks only when every box holds something real.
 */
export default function GroundingTherapy() {
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<string[][]>(
    STEPS.map((s) => Array(s.count).fill(""))
  );
  const [done, setDone] = useState(false);

  const step = STEPS[stepIdx];
  const filled = values[stepIdx].every((v) => v.trim().length > 0);

  const setValue = (i: number, v: string) => {
    setValues((prev) => prev.map((arr, s) => (s === stepIdx ? arr.map((x, j) => (j === i ? v : x)) : arr)));
  };

  const restart = () => {
    setValues(STEPS.map((s) => Array(s.count).fill("")));
    setStepIdx(0);
    setDone(false);
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
          <p className="text-sm font-medium tracking-tight text-neutral-100">Grounding</p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
            Come back to the room, one sense at a time.
          </p>
        </div>
        {!done && (
          <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs tabular-nums text-neutral-400">
            {stepIdx + 1} of {STEPS.length}
          </span>
        )}
      </div>

      {/* Progress thread */}
      {!done && (
        <div className="mt-4 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.sense} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-neutral-300"
                initial={false}
                animate={{ width: i < stepIdx ? "100%" : i === stepIdx ? "45%" : "0%" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="ground-done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="py-6 text-center"
          >
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/10 text-lg text-emerald-300">
              ✓
            </span>
            <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-neutral-200">
              You&apos;re here. The room held you the whole time.
            </p>
            <button
              onClick={restart}
              className="mx-auto mt-4 flex items-center gap-2 text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-300 hover:underline"
            >
              <RotateCcw size={13} /> Begin again
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={step.sense}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="pt-5"
          >
            <p className="text-[15px] font-medium leading-snug text-neutral-100">{step.prompt}</p>
            <div className="mt-4 space-y-3">
              {values[stepIdx].map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-xs tabular-nums text-neutral-600">
                    {i + 1}
                  </span>
                  <input
                    value={v}
                    onChange={(e) => setValue(i, e.target.value)}
                    placeholder="Name it…"
                    maxLength={80}
                    className="w-full border-b border-white/10 bg-transparent pb-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-700 focus:border-white/30"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setStepIdx((s) => Math.max(s - 1, 0))}
                disabled={stepIdx === 0}
                className="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300 disabled:opacity-30 disabled:hover:text-neutral-500"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <MagneticButton
                fit
                onClick={() => {
                  if (stepIdx + 1 >= STEPS.length) setDone(true);
                  else setStepIdx((s) => s + 1);
                }}
                disabled={!filled}
                ariaLabel={stepIdx + 1 >= STEPS.length ? "Finish grounding" : "Next grounding step"}
                className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition ${
                  filled
                    ? "bg-neutral-100 text-neutral-900 hover:bg-white"
                    : "cursor-not-allowed bg-white/5 text-neutral-600"
                }`}
              >
                {stepIdx + 1 >= STEPS.length ? "Finish" : "Next"} <ArrowRight size={14} />
              </MagneticButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </SpotlightCard>
  );
}
