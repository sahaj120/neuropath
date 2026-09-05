"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, type Variants } from "framer-motion";
import { ArrowRight, Check, Download, Timer } from "lucide-react";
import AudioPlayer from "../components/AudioPlayer";
import AuroraBackground from "../components/AuroraBackground";
import BilateralTherapy from "../components/BilateralTherapy";
import FocusPrimer from "../components/FocusPrimer";
import GroundingTherapy from "../components/GroundingTherapy";
import KineticText from "../components/KineticText";
import MagneticButton from "../components/MagneticButton";
import NeuralCanvas from "../components/NeuralCanvas";
import NoiseOverlay from "../components/NoiseOverlay";
import PhotophobiaGuard from "../components/PhotophobiaGuard";
import SpotlightCard from "../components/SpotlightCard";
import VestibularTrainer from "../components/VestibularTrainer";
import {
  isSevere,
  requestTriage,
  visualUnlock,
  type TherapyModule,
  type TriageResult,
} from "../lib/triage";

type Step = "intake" | "loading" | "module" | "summary";

const SYMPTOMS = [
  { key: "headache", label: "Headache" },
  { key: "dizziness", label: "Dizziness" },
  { key: "fog", label: "Fog" },
  { key: "light", label: "Light" },
] as const;

const TRACK_TITLES: Record<string, string> = {
  "https://www.youtube.com/watch?v=KB2F6MaTFlE": "Focus Stream",
  "https://www.youtube.com/watch?v=0J3STr6lbIo": "Rest Stream",
  "https://www.youtube.com/watch?v=wtr4jRcVmEc": "Calm Stream",
};

/* Session order is fixed and calm; pacing inside each module is AI driven. */
const FIXED_ORDER: TherapyModule[] = ["Audio", "Bilateral", "Grounding", "Saccade"];

const MODULE_LABEL: Record<TherapyModule, string> = {
  Audio: "Listening",
  Bilateral: "Bilateral light",
  Grounding: "Grounding",
  Saccade: "Eye training",
};

const PROFILE_KEY = "neuroPath-profile-baseline";
const BASELINES = [
  "ADHD & Focus Loss",
  "Anxiety & Panic",
  "Sensory Overload",
  "Burnout & Fatigue",
  "Recent Concussion",
  "General Well-being",
] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

const screen: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25, ease: "easeIn" } },
};

/* Aurora moods linked to the AI triage theme */
const AURORA: Record<string, string[]> = {
  "bg-blue-950/20": [
    "rgba(37,99,235,0.22)",
    "rgba(6,182,212,0.16)",
    "rgba(16,185,129,0.10)",
    "rgba(59,130,246,0.12)",
  ],
  "bg-emerald-950/20": [
    "rgba(16,185,129,0.20)",
    "rgba(45,212,191,0.14)",
    "rgba(6,182,212,0.10)",
    "rgba(52,211,153,0.12)",
  ],
  "bg-amber-950/20": [
    "rgba(245,158,11,0.20)",
    "rgba(251,146,60,0.14)",
    "rgba(250,204,21,0.08)",
    "rgba(249,115,22,0.12)",
  ],
  "bg-neutral-950": [
    "rgba(82,82,91,0.15)",
    "rgba(63,63,70,0.12)",
    "rgba(39,39,42,0.13)",
    "rgba(113,113,122,0.08)",
  ],
};

/* Ultra-minimalist custom slider: native styling hidden, Tailwind track only */
function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-neutral-300">{label}</span>
        <span className="min-w-8 rounded-full border border-white/10 px-2.5 py-0.5 text-center text-xs font-medium tabular-nums text-neutral-400">
          {value}
        </span>
      </div>
      <div className="relative flex h-9 items-center">
        <div className="h-[3px] w-full rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-neutral-200"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          />
        </div>
        <motion.div
          className="absolute h-3 w-3 rounded-full bg-neutral-100 shadow-[0_0_12px_rgba(255,255,255,0.45)]"
          initial={false}
          animate={{ left: `calc(${pct}% - 6px)` }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        />
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="np-native-hide absolute inset-0 h-full w-full cursor-pointer"
        />
      </div>
    </div>
  );
}

/** Gentle session timer counting toward the recommended screen limit. */
function PacingTimer({ limitMins }: { limitMins: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (limitMins <= 0) return;
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [limitMins]);

  if (limitMins <= 0) {
    return (
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        No screen goals today. Rest somewhere dark and calm, and let your body lead.
      </p>
    );
  }
  const total = limitMins * 60;
  const done = elapsed >= total;
  const mm = Math.floor(Math.min(elapsed, total) / 60);
  const ss = (Math.min(elapsed, total) % 60).toString().padStart(2, "0");
  return (
    <div className="mt-4">
      <div className="flex items-center justify-center gap-2 text-xs tabular-nums text-neutral-400">
        <Timer size={13} />
        <span>
          {mm}:{ss} of {limitMins}m
        </span>
      </div>
      <div className="mx-auto mt-2 h-1 max-w-[220px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-neutral-300 transition-[width] duration-500"
          style={{ width: `${Math.min((elapsed / total) * 100, 100)}%` }}
        />
      </div>
      {done && (
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          That is the gentle limit. Time for a quiet break.
        </p>
      )}
    </div>
  );
}

/** Slow animated breathing companion following the prescribed pace. */
function BreathingPacer({ pace }: { pace: "4-7-8" | "box-breathing" }) {
  const phases =
    pace === "4-7-8"
      ? [
          { label: "Breathe in", s: 4, scale: 1.18 },
          { label: "Hold", s: 7, scale: 1.18 },
          { label: "Let go", s: 8, scale: 0.85 },
        ]
      : [
          { label: "Breathe in", s: 4, scale: 1.18 },
          { label: "Hold", s: 4, scale: 1.18 },
          { label: "Breathe out", s: 4, scale: 0.85 },
          { label: "Rest", s: 4, scale: 0.85 },
        ];
  const [idx, setIdx] = useState(0);
  const [round, setRound] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (idx + 1 >= phases.length) {
        setIdx(0);
        setRound((r) => r + 1);
      } else {
        setIdx(idx + 1);
      }
    }, phases[idx].s * 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, pace]);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#0A0A0A]/60 p-5">
      <motion.div
        className="h-14 w-14 shrink-0 rounded-full bg-neutral-100 shadow-[0_0_28px_rgba(255,255,255,0.25)]"
        initial={false}
        animate={{ scale: phases[idx].scale, opacity: phases[idx].scale > 1 ? 1 : 0.75 }}
        transition={{ duration: phases[idx].s, ease: "easeInOut" }}
      />
      <div>
        <p className="text-sm font-medium text-neutral-100">{phases[idx].label}...</p>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
          {pace === "4-7-8" ? "4-7-8 rhythm" : "Box breathing"} · round {round} · follow the glow
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("intake");
  const [moduleIdx, setModuleIdx] = useState(0);
  const [note, setNote] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({
    headache: 3,
    dizziness: 3,
    fog: 3,
    light: 3,
  });
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [audioTouched, setAudioTouched] = useState(false);
  const [eyeSeconds, setEyeSeconds] = useState(0);
  const [eyeSessions, setEyeSessions] = useState(0);

  /* First-time user check */
  const [profileChecked, setProfileChecked] = useState(false);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { baseline?: string };
        if (parsed && typeof parsed.baseline === "string") {
          setBaseline(parsed.baseline);
        }
      }
    } catch {
      /* corrupted or unavailable storage: treat as new */
    }
    setProfileChecked(true);
  }, []);

  const completeOnboarding = () => {
    if (!pick) return;
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ baseline: pick, createdAt: new Date().toISOString() })
      );
    } catch {
      /* storage blocked: still let them through for this session */
    }
    setBaseline(pick);
  };

  const resetPrototype = () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  const analyze = async () => {
    setStep("loading");
    const started = Date.now();
    const result = await requestTriage({
      patientNotes: note,
      scores: {
        headache: scores.headache,
        dizziness: scores.dizziness,
        fog: scores.fog,
        light: scores.light,
      },
      baseline,
    });
    const wait = Math.max(0, 2200 - (Date.now() - started));
    window.setTimeout(() => {
      setTriage(result);
      setModuleIdx(0);
      setStep("module");
    }, wait);
  };

  const startOver = () => {
    setTriage(null);
    setAudioTouched(false);
    setEyeSeconds(0);
    setEyeSessions(0);
    setModuleIdx(0);
    setStep("intake");
  };

  const scored = {
    headache: scores.headache,
    dizziness: scores.dizziness,
    fog: scores.fog,
    light: scores.light,
  };
  const limit = isSevere(scored) ? 0 : 15;
  const severe = isSevere(scored);
  const eyesOpen = visualUnlock(scored);
  // Calm dark default; warm amber wash only when symptoms run high.
  const theme = severe ? "bg-amber-950/20" : "bg-neutral-950";
  const auroraColors = AURORA[theme] ?? AURORA["bg-neutral-950"];

  const order = FIXED_ORDER;
  const current: TherapyModule | undefined = order[moduleIdx];
  const isLast = moduleIdx >= order.length - 1;

  const advance = () => {
    if (isLast) setStep("summary");
    else setModuleIdx((i) => i + 1);
  };

  const exportSummary = () => {
    if (!triage) return;
    const lines = [
      "NEUROPATH - SESSION SUMMARY",
      `Date: ${new Date().toLocaleString()}`,
      `Phase: ${triage.triagePhase}`,
      `Modules completed: ${order.join(", ") || "guided session"}`,
      `Screen rhythm: ${limit === 0 ? "Full rest" : `${limit} gentle minutes`}`,
      `Sound: ${audioTouched ? (TRACK_TITLES[triage.prescribedYoutubeUrl] ?? triage.prescribedYoutubeUrl) : "Rested in quiet"}`,
      `Saccade pace: ${triage.saccadeSpeedMs}ms per glide`,
      `Breathing: 4-7-8 rhythm`,
      `Eye training: ${eyeSessions > 0 ? `${eyeSessions} rounds, ${Math.round(eyeSeconds)}s` : eyesOpen ? "Skipped" : "Held for safety"}`,
      "",
      `Note: ${triage.clinicalRationale}`,
      "",
      "Gentle prototype, not medical advice. Share with your clinician if helpful.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neuropath-session-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const navLabel =
    step === "intake"
      ? "Check-in"
      : step === "loading"
        ? "Tuning"
        : step === "module" && current
          ? MODULE_LABEL[current]
          : "Summary";

  return (
    <main className="relative min-h-screen bg-[#0A0A0A] text-neutral-100">
      <NeuralCanvas color={severe ? "#fb9233" : "#22d3ee"} />
      <NoiseOverlay />
      <AuroraBackground colors={auroraColors} />
      {/* Dynamic mood layer: the whole site shifts with the diagnosis */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 transition-colors duration-700 ${theme}`}
      />

      {triage && (step === "module" || step === "summary") && (
        <PhotophobiaGuard tint={severe ? "amber" : "none"} />
      )}

      {/* Floating glass nav */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed inset-x-0 top-4 z-50 mx-auto w-fit"
      >
        <div className="flex items-center gap-2.5 rounded-full border border-white/5 bg-black/50 py-2 pl-3 pr-5 backdrop-blur-xl">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-[11px] text-neutral-900">
            ✦
          </span>
          <span className="text-[13px] font-medium tracking-tight text-neutral-200">
            NeuroPath
          </span>
          <span className="ml-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {navLabel}
          </span>
        </div>
      </motion.header>

      {/* Subtle step indicator for the guided sequence */}
      {step === "module" && current && (
        <motion.p
          key={`indicator-${moduleIdx}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-x-0 top-[68px] z-40 text-center text-[10px] font-medium uppercase tracking-widest text-neutral-400"
        >
          Step {moduleIdx + 1} of {order.length}: {MODULE_LABEL[current]}
        </motion.p>
      )}

      {/* First-time onboarding overlay */}
      <AnimatePresence>
        {profileChecked && baseline === null && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0A0A]/80 px-5 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="w-full max-w-md rounded-3xl border border-white/5 bg-[#171717] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:p-9"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
              >
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-base text-neutral-900">
                  ✦
                </span>
                <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  Welcome to NeuroPath
                </p>
                <h2 className="mt-2 text-2xl font-medium leading-snug tracking-tight text-neutral-100">
                  <KineticText text="What brings you here today?" />
                </h2>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
                className="mt-6 flex flex-wrap justify-center gap-2"
              >
                {BASELINES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setPick(b)}
                    className={`rounded-full px-5 py-2.5 text-sm transition active:scale-95 ${
                      pick === b
                        ? "bg-neutral-100 font-medium text-neutral-900"
                        : "border border-white/10 text-neutral-300 hover:bg-white/5 hover:text-neutral-100"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
              >
                <MagneticButton
                  onClick={completeOnboarding}
                  disabled={!pick}
                  ariaLabel="Begin NeuroPath"
                  className={`mt-7 w-full rounded-full py-3.5 text-[15px] font-medium tracking-tight transition ${
                    pick
                      ? "bg-neutral-100 text-neutral-900 hover:bg-white"
                      : "cursor-not-allowed bg-white/5 text-neutral-600"
                  }`}
                >
                  Begin
                </MagneticButton>
                <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
                  Saved only on this device. Nothing leaves your phone.
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Judge reset: clears storage and reloads for a fresh first run */}
      <button
        onClick={resetPrototype}
        className="fixed bottom-4 right-5 z-[95] text-[11px] text-neutral-600 underline-offset-4 transition hover:text-neutral-300 hover:underline"
      >
        Reset Prototype
      </button>

      <LayoutGroup>
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-5 pb-20 pt-28 sm:px-8">
          <AnimatePresence mode="wait">
            {/* Step 0: centered intake */}
            {step === "intake" && (
              <motion.section
                key="intake"
                variants={screen}
                initial="hidden"
                animate="show"
                exit="exit"
                className="w-full"
              >
                <motion.div variants={container} initial="hidden" animate="show">
                  <motion.div variants={item} className="text-center">
                    <h1 className="text-3xl font-medium leading-snug tracking-tight text-neutral-100 sm:text-4xl">
                      <KineticText text="How is your head today?" />
                    </h1>
                    <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-neutral-400">
                      A slow minute for yourself. There are no wrong answers here.
                    </p>
                    {baseline && (
                      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-neutral-600">
                        Here for {baseline.toLowerCase()}, we will tune around that.
                      </p>
                    )}
                  </motion.div>

                  <motion.div variants={item} className="mt-7">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      placeholder="Tell us in your own words: your head, energy, sleep, anything that feels off..."
                      className="w-full resize-none rounded-2xl border border-white/10 bg-[#171717]/80 p-5 text-[15px] leading-relaxed text-neutral-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)] outline-none backdrop-blur-xl transition placeholder:text-neutral-600 focus:border-white/20"
                    />
                  </motion.div>

                  <motion.div variants={item} className="mt-4">
                    <SpotlightCard className="space-y-4 p-5 sm:p-6">
                      {SYMPTOMS.map((s) => (
                        <Slider
                          key={s.key}
                          label={s.label}
                          value={scores[s.key]}
                          onChange={(v) => setScores((p) => ({ ...p, [s.key]: v }))}
                        />
                      ))}
                    </SpotlightCard>
                  </motion.div>

                  <motion.div variants={item}>
                    <MagneticButton
                      onClick={analyze}
                      ariaLabel="Analyze check in"
                      className="mt-7 w-full rounded-full bg-neutral-100 py-4 text-[15px] font-medium tracking-tight text-neutral-900 transition hover:bg-white"
                    >
                      Analyze
                    </MagneticButton>
                  </motion.div>
                </motion.div>
              </motion.section>
            )}

            {/* Loading */}
            {step === "loading" && (
              <motion.section
                key="loading"
                variants={screen}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex w-full flex-col items-center justify-center py-16 text-center"
              >
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <motion.span
                    className="absolute h-full w-full rounded-full bg-white/[0.07] blur-2xl"
                    animate={{ scale: [1, 1.35, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.span
                    className="absolute h-20 w-20 rounded-full border border-white/10"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.9, 0.5] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  />
                  <motion.span
                    className="h-10 w-10 rounded-full bg-neutral-100 shadow-[0_0_40px_rgba(255,255,255,0.35)]"
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  />
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mt-9 animate-pulse text-[15px] leading-relaxed text-neutral-300"
                >
                  Reading your words with care...
                </motion.p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                  Shaping the day around how you feel.
                </p>
              </motion.section>
            )}

            {/* Steps 1..N: one prescribed therapy at a time */}
            {step === "module" && triage && current && (
              <motion.section
                key={`module-${moduleIdx}`}
                variants={screen}
                initial="hidden"
                animate="show"
                exit="exit"
                className="w-full"
              >
                <motion.div variants={container} initial="hidden" animate="show">
                  {current === "Audio" && (
                    <>
                      <motion.div variants={item} className="text-center">
                        <h2 className="mx-auto mt-2 max-w-sm text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
                          <KineticText
                            text={limit === 0 ? "A quiet day is recommended" : "Settle in and listen"}
                          />
                        </h2>
                        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
                          {triage.clinicalRationale}
                        </p>
                      </motion.div>
                      <motion.div variants={item} className="mt-6">
                        <SpotlightCard className="p-6 text-center sm:p-7">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                            Screen Time Limit
                          </p>
                          <p className="mt-2 text-5xl font-medium tabular-nums tracking-tight text-white">
                            {limit}
                            <span className="text-xl text-white/50">m</span>
                          </p>
                          <PacingTimer limitMins={limit} />
                        </SpotlightCard>
                      </motion.div>
                      <motion.div variants={item} className="mt-4">
                        <AudioPlayer
                          prescribedYoutubeUrl={triage.prescribedYoutubeUrl}
                          onFirstInteract={() => setAudioTouched(true)}
                        />
                      </motion.div>
                      <motion.div variants={item} className="mt-4">
                        <BreathingPacer pace="4-7-8" />
                      </motion.div>
                      <motion.div variants={item} className="mt-4">
                        <FocusPrimer />
                      </motion.div>
                    </>
                  )}

                  {current === "Bilateral" && (
                    <>
                      <motion.div variants={item} className="text-center">
                        <h2 className="mx-auto max-w-sm text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
                          <KineticText text="Ride the light" />
                        </h2>
                        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
                          Side to side, slow and steady. Let your shoulders drop.
                        </p>
                      </motion.div>
                      <motion.div variants={item} className="mt-6">
                        <BilateralTherapy />
                      </motion.div>
                    </>
                  )}

                  {current === "Grounding" && (
                    <>
                      <motion.div variants={item} className="text-center">
                        <h2 className="mx-auto max-w-sm text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
                          <KineticText text="Come back to the room" />
                        </h2>
                        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
                          Name what is real around you. There is no rush.
                        </p>
                      </motion.div>
                      <motion.div variants={item} className="mt-6">
                        <GroundingTherapy />
                      </motion.div>
                    </>
                  )}

                  {current === "Saccade" && (
                    <>
                      <motion.div variants={item} className="text-center">
                        <h2 className="mx-auto mt-2 max-w-sm text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
                          <KineticText text="Follow the glow" />
                        </h2>
                        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
                          Eyes only. Keep your head perfectly still.
                        </p>
                      </motion.div>
                      <motion.div variants={item} className="mt-6">
                        <VestibularTrainer
                          unlocked={eyesOpen}
                          speedMs={triage.saccadeSpeedMs}
                          onSession={(s) => {
                            setEyeSessions((n) => n + 1);
                            setEyeSeconds((t) => t + s);
                          }}
                        />
                      </motion.div>
                    </>
                  )}

                  <motion.div variants={item} className="mt-6 flex justify-end">
                    <MagneticButton
                      onClick={advance}
                      ariaLabel={isLast ? "Finish session" : "Continue to next step"}
                      fit
                      className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-8 py-3.5 text-[15px] font-medium tracking-tight text-neutral-900 transition hover:bg-white"
                    >
                      {isLast ? (
                        <>Finish <Check size={16} /></>
                      ) : (
                        <>Continue <ArrowRight size={16} /></>
                      )}
                    </MagneticButton>
                  </motion.div>
                </motion.div>
              </motion.section>
            )}

            {/* Final step: session summary */}
            {step === "summary" && triage && (
              <motion.section
                key="summary"
                variants={screen}
                initial="hidden"
                animate="show"
                exit="exit"
                className="w-full"
              >
                <motion.div variants={container} initial="hidden" animate="show">
                  <motion.div variants={item} className="text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                      <Check size={18} />
                    </span>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                      Session Complete
                    </p>
                    <h2 className="mx-auto mt-2 max-w-sm text-2xl font-medium leading-snug tracking-tight text-white sm:text-3xl">
                      <KineticText text="Beautifully done today" />
                    </h2>
                    <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">
                      {triage.triagePhase}, every gentle
                      minute counts.
                    </p>
                  </motion.div>

                  <motion.div variants={item} className="mt-6">
                    <SpotlightCard className="space-y-1 p-6">
                      {[
                        {
                          k: "Screen rhythm",
                          v: limit === 0 ? "Full rest" : `${limit} gentle minutes`,
                        },
                        {
                          k: "Sound",
                          v: audioTouched
                            ? (TRACK_TITLES[triage.prescribedYoutubeUrl] ?? "Listening session")
                            : "Rested in quiet",
                        },
                        {
                          k: "Saccade pace",
                          v: `${triage.saccadeSpeedMs}ms per glide`,
                        },
                        {
                          k: "Breathing",
                          v: "4-7-8 rhythm",
                        },
                        { k: "Path", v: order.join(", ") || "guided session" },
                        {
                          k: "Eye training",
                          v:
                            eyeSessions > 0
                              ? `${eyeSessions} rounds, ${Math.round(eyeSeconds)}s of tracking`
                              : eyesOpen
                                ? "Skipped, always okay"
                                : "Held for safety",
                        },
                      ].map((row) => (
                        <div
                          key={row.k}
                          className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0"
                        >
                          <span className="text-sm text-neutral-500">{row.k}</span>
                          <span className="text-right text-sm font-medium text-neutral-200">
                            {row.v}
                          </span>
                        </div>
                      ))}
                    </SpotlightCard>
                  </motion.div>

                  <motion.div variants={item}>
                    <p className="mx-auto mt-6 max-w-sm text-center text-sm leading-relaxed text-neutral-400">
                      &ldquo;{triage.clinicalRationale}&rdquo;
                    </p>
                    <MagneticButton
                      onClick={exportSummary}
                      ariaLabel="Export session summary"
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-3.5 text-sm font-medium text-neutral-200 transition hover:bg-white/5"
                    >
                      <Download size={15} /> Export Session Summary
                    </MagneticButton>
                    <button
                      onClick={startOver}
                      className="mx-auto mt-4 block text-sm text-neutral-500 underline-offset-4 transition hover:text-neutral-300 hover:underline"
                    >
                      Check in again
                    </button>
                  </motion.div>
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </main>
  );
}
