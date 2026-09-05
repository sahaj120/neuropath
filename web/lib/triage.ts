/**
 * Shared triage contracts + deterministic fallback.
 * The AI returns a strict clinical payload (phase, rationale, prescribed
 * audio file, saccade pacing). Audio selection and visual speed live ONLY
 * in that payload: the UI renders them as strict props with no overrides.
 * Safety gating stays derived in code so the model can never waive it.
 */

/** Headless YouTube prescriptions. The player streams these with no local files. */
export const YOUTUBE_PRESCRIPTIONS = {
  focus: "https://www.youtube.com/watch?v=KB2F6MaTFlE",
  rest: "https://www.youtube.com/watch?v=0J3STr6lbIo",
  calm: "https://www.youtube.com/watch?v=wtr4jRcVmEc",
} as const;

export type YoutubeUrl = (typeof YOUTUBE_PRESCRIPTIONS)[keyof typeof YOUTUBE_PRESCRIPTIONS];

/** Fixed session modules, always rendered in this calm order. */
export type TherapyModule = "Audio" | "Bilateral" | "Grounding" | "Saccade";

export interface SymptomScores {
  headache: number;
  dizziness: number;
  fog: number;
  light: number;
}

export interface TriageResult {
  triagePhase: string;
  clinicalRationale: string;
  prescribedYoutubeUrl: YoutubeUrl;
  saccadeSpeedMs: number;
}

export interface CheckIn {
  patientNotes: string;
  scores: SymptomScores;
  baseline?: string | null;
}

/** Hard safety rule: code, never the model, has the final word. */
export function isSevere(s: SymptomScores): boolean {
  return s.headache >= 7 || s.dizziness >= 7 || s.fog >= 7 || s.light >= 7;
}

/** Visual-training gate derived from severity (model cannot override). */
export function visualUnlock(scores: SymptomScores): boolean {
  return !(scores.dizziness >= 7 || scores.headache >= 7 || isSevere(scores));
}

/** Deterministic fallback used on rate limits, outages, or missing keys. */
export function fallbackTriage(checkin: CheckIn): TriageResult {
  const { scores } = checkin;
  const worst = Math.max(scores.headache, scores.dizziness, scores.fog, scores.light);

  if (worst >= 7) {
    return {
      triagePhase: "Acute Rest",
      clinicalRationale:
        "Your symptoms point to full quiet today. Rest somewhere dark and calm, this is healing, not falling behind.",
      prescribedYoutubeUrl: YOUTUBE_PRESCRIPTIONS.rest,
      saccadeSpeedMs: 3000,
    };
  }
  if (worst >= 4) {
    return {
      triagePhase: "Sub-Symptom Active",
      clinicalRationale:
        "You are ready for gentle activity in small doses. Keep sessions short and ease off the moment anything feels worse.",
      prescribedYoutubeUrl: YOUTUBE_PRESCRIPTIONS.calm,
      saccadeSpeedMs: 2000,
    };
  }
  return {
    triagePhase: "Return to Play",
    clinicalRationale:
      "A steady day. You can ease back into normal rhythms while alternating focus with short rests.",
    prescribedYoutubeUrl: YOUTUBE_PRESCRIPTIONS.focus,
    saccadeSpeedMs: 1000,
  };
}

/** Client helper: POST to the triage route, fall back locally on any failure. */
export async function requestTriage(checkin: CheckIn): Promise<TriageResult> {
  try {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkin),
    });
    if (!res.ok) throw new Error(`triage route ${res.status}`);
    const data = (await res.json()) as TriageResult;
    if (!data || typeof data !== "object" || typeof data.triagePhase !== "string") {
      throw new Error("malformed triage payload");
    }
    const urls = Object.values(YOUTUBE_PRESCRIPTIONS) as string[];
    const speed = Number(data.saccadeSpeedMs);
    return {
      triagePhase: data.triagePhase.slice(0, 80),
      clinicalRationale:
        typeof data.clinicalRationale === "string" && data.clinicalRationale.trim()
          ? data.clinicalRationale.trim().slice(0, 400)
          : fallbackTriage(checkin).clinicalRationale,
      prescribedYoutubeUrl: urls.includes(data.prescribedYoutubeUrl)
        ? (data.prescribedYoutubeUrl as YoutubeUrl)
        : fallbackTriage(checkin).prescribedYoutubeUrl,
      saccadeSpeedMs: Number.isFinite(speed)
        ? Math.min(Math.max(Math.round(speed), 800), 4000)
        : fallbackTriage(checkin).saccadeSpeedMs,
    };
  } catch {
    return fallbackTriage(checkin);
  }
}
