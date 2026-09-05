import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  fallbackTriage,
  YOUTUBE_PRESCRIPTIONS,
  type CheckIn,
  type TriageResult,
  type YoutubeUrl,
} from "@/lib/triage";

const SYSTEM_PROMPT = `You are a warm neuro-recovery specialist inside a concussion recovery app.
Read the patient's freeform note and symptom scores (each 1-10), then respond with STRICT JSON ONLY, no markdown, no fences, no extra text:
{
  "triagePhase": "string, one of: Acute Rest, Sub-Symptom Active, Return to Play",
  "clinicalRationale": "string, 1-2 sentences, empathetic, grounded directly in what the patient wrote",
  "prescribedYoutubeUrl": "string, exactly one of the three links below, nothing else",
  "saccadeSpeedMs": number (milliseconds per visual glide: 3000 for slow and severe, 2000 for moderate, 1000 for fast and mild)
}
Prescription rules you MUST follow (return the link text exactly):
- ADHD / Focus Loss: "https://www.youtube.com/watch?v=KB2F6MaTFlE"
- Acute Rest / Headaches: "https://www.youtube.com/watch?v=0J3STr6lbIo"
- Anxiety / Vestibular: "https://www.youtube.com/watch?v=wtr4jRcVmEc"
- Severe symptoms (7 or higher): phase "Acute Rest", saccadeSpeedMs 3000.
- Moderate symptoms (4 to 6): phase "Sub-Symptom Active", saccadeSpeedMs 2000.
- Mild symptoms (under 4): phase "Return to Play", saccadeSpeedMs 1000.
- Never give drug or diagnostic claims; tone calm and kind.`;

/** Coerce and validate model output; any deviation collapses to the safe fallback. */
function coerce(parsed: unknown, checkin: CheckIn): TriageResult {
  const fallback = fallbackTriage(checkin);
  if (!parsed || typeof parsed !== "object") return fallback;
  const p = parsed as Record<string, unknown>;

  const phases = ["Acute Rest", "Sub-Symptom Active", "Return to Play"];
  const urls = Object.values(YOUTUBE_PRESCRIPTIONS) as string[];

  const triagePhase =
    typeof p.triagePhase === "string" && phases.includes(p.triagePhase)
      ? p.triagePhase
      : fallback.triagePhase;
  const clinicalRationale =
    typeof p.clinicalRationale === "string" && p.clinicalRationale.trim().length > 0
      ? p.clinicalRationale.trim().slice(0, 400)
      : fallback.clinicalRationale;
  const prescribedYoutubeUrl = urls.includes(p.prescribedYoutubeUrl as string)
    ? (p.prescribedYoutubeUrl as YoutubeUrl)
    : fallback.prescribedYoutubeUrl;
  const ms = Number(p.saccadeSpeedMs);
  const saccadeSpeedMs = Number.isFinite(ms)
    ? Math.min(Math.max(Math.round(ms), 800), 4000)
    : fallback.saccadeSpeedMs;

  return { triagePhase, clinicalRationale, prescribedYoutubeUrl, saccadeSpeedMs };
}

export async function POST(req: Request) {
  let checkin: CheckIn;
  try {
    const body = (await req.json()) as Partial<CheckIn>;
    const s = (body.scores ?? {}) as Record<string, unknown>;
    const num = (v: unknown, dflt: number) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), 10) : dflt;
    };
    checkin = {
      patientNotes: typeof body.patientNotes === "string" ? body.patientNotes.slice(0, 2000) : "",
      scores: {
        headache: num(s.headache, 3),
        dizziness: num(s.dizziness, 3),
        fog: num(s.fog, 3),
        light: num(s.light, 3),
      },
      baseline: typeof body.baseline === "string" ? body.baseline.slice(0, 80) : null,
    };
  } catch {
    return NextResponse.json({ error: "Expected JSON with patientNotes and scores." }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json(fallbackTriage(checkin));

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    });
    const prompt =
      `${SYSTEM_PROMPT}\n\nPatient note: """${checkin.patientNotes || "(no note written)"}"""\n` +
      `Scores: headache ${checkin.scores.headache}, dizziness ${checkin.scores.dizziness}, ` +
      `fog ${checkin.scores.fog}, light sensitivity ${checkin.scores.light}.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, "").trim();
    return NextResponse.json(coerce(JSON.parse(text), checkin));
  } catch {
    // Rate limits (429), outages, quota, malformed JSON: always degrade safely.
    return NextResponse.json(fallbackTriage(checkin));
  }
}
