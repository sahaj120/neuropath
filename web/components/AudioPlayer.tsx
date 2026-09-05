"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Pause, Play, Volume2 } from "lucide-react";
import ReactPlayer from "react-player/lazy";
import SpotlightCard from "./SpotlightCard";

/**
 * Prescription-only headless YouTube player. The video feed stays fully
 * hidden while our custom glass Play/Pause button drives playback through
 * the `isPlaying` state. Track, volume, and badge are the whole surface:
 * no menus, no lists, no overrides.
 */
export default function AudioPlayer({
  prescribedYoutubeUrl,
  onFirstInteract,
}: {
  prescribedYoutubeUrl: string;
  onFirstInteract?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [missing, setMissing] = useState(false);
  const interactedRef = useRef(false);

  /* A new prescription stops playback and loads the fresh URL. */
  useEffect(() => {
    setIsPlaying(false);
    setMissing(false);
  }, [prescribedYoutubeUrl]);

  const toggle = () => {
    if (!interactedRef.current) {
      interactedRef.current = true;
      onFirstInteract?.();
    }
    setIsPlaying((p) => !p);
  };

  return (
    <SpotlightCard className="w-full p-5 sm:p-6">
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 10 },
          show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
        }}
      >
      {/* Hidden headless stream: audio only, never a visible frame. */}
      <ReactPlayer
        url={prescribedYoutubeUrl}
        playing={isPlaying}
        volume={volume}
        width="0"
        height="0"
        style={{ display: "none" }}
        onError={() => {
          setMissing(true);
          setIsPlaying(false);
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-tight text-neutral-100">
            Prescribed Sound Session
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">
            {prescribedYoutubeUrl}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-neutral-300">
          <Lock size={11} /> AI Prescribed Acoustic Therapy
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.94 }}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 shadow-[0_0_32px_rgba(255,255,255,0.12)] transition hover:bg-white"
        >
          {isPlaying ? (
            <Pause size={20} strokeWidth={1.8} fill="currentColor" />
          ) : (
            <Play size={20} strokeWidth={1.8} fill="currentColor" className="ml-0.5" />
          )}
        </motion.button>
        <div className="flex flex-1 items-center gap-2.5">
          <Volume2 size={15} className="shrink-0 text-neutral-500" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-neutral-100"
          />
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
        {missing
          ? "This stream could not start. Check your connection, then press play again."
          : "Headphones on, volume low. Stop any time you need quiet."}
      </p>
      </motion.div>
    </SpotlightCard>
  );
}
