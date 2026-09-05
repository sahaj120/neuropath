"""
NeuroPath — Distributed Background Processing Engine (Render Workflows + Gemini).

Durable workflow task: clinical intake analysis (Gemini Flash) with a
deterministic safety guardrail, plus 30-second binaural soundscape synthesis.
Runs on Render Workflow infrastructure; degrades gracefully to synchronous
local execution when the SDK / infrastructure is unavailable.

Local synchronous run:
    python workflow.py --local
Render dev loop:
    render workflows dev
Production worker entrypoint:
    python workflow.py            # -> start()
"""
import base64
import io
import os
import re
import sys
import wave

import numpy as np
from scipy.signal.windows import tukey

# --------------------------------------------------------------------------
# 1. IMPORTS — Render Workflows SDK (shim-aware) + Gemini (silent fallback)
# --------------------------------------------------------------------------
try:
    # Preferred import path per Render docs (compatibility shim still works).
    from render_sdk.workflows import start, task
    _HAS_WORKFLOWS = True
except ImportError:  # pragma: no cover - local / SDK-less environments
    try:
        from render.workflows import start, task  # renamed package
        _HAS_WORKFLOWS = True
    except ImportError:
        _HAS_WORKFLOWS = False

        # Minimal stand-in so the module stays importable and runnable locally:
        # @task becomes a pass-through, start() explains the Render CLI path.
        def task(_func=None, **kwargs):
            def _wrap(fn):
                return fn
            return _wrap(_func) if callable(_func) else _wrap

        def start():  # noqa: D103
            print("[workflow] render_sdk not installed — running in local sync mode.")
            print("[workflow] Install it with: pip install render-sdk")
            print("[workflow] Or emulate the worker with: render workflows dev")
            if "--local" in sys.argv:
                _local_demo()


def _gemini_key():
    """Backend key loading: environment only (never a UI field)."""
    return (os.getenv("GEMINI_API_KEY") or "").strip()


# --------------------------------------------------------------------------
# HELPERS
# --------------------------------------------------------------------------
def _scrub_phi(text):
    """Strip likely PHI (emails, phone numbers) before any LLM call."""
    clean = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[EMAIL]", text or "")
    clean = re.sub(r"\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}", "[PHONE]", clean)
    return clean.strip()


def _gemini_analyze(notes, symptoms):
    """Query Gemini Flash as a concussion specialist. Silent mock fallback."""
    prompt = (
        "You are a board-level concussion specialist advising a rehabilitation app. "
        "Patient note: '%s'. Symptom scores /10: headache %s, dizziness %s, photophobia %s, brain fog %s. "
        "Classify ONE status: REST_PHASE (needs full cognitive/physical rest), "
        "ACTIVE_SUB_SYMPTOM_THRESHOLD (gentle sub-symptom activity OK), or RETURN_TO_WORK_PLAY "
        "(graded return). Then prescribe: (1) screen limit in minutes per session, "
        "(2) dual-task tolerance in one line. Under 110 words, calm clinical tone, no drug "
        "or definitive diagnostic claims." % (
            notes or "No note provided.",
            symptoms.get("headache"), symptoms.get("dizziness"),
            symptoms.get("photophobia"), symptoms.get("brain_fog")))
    key = _gemini_key()
    if key:
        try:
            from google import genai
            client = genai.Client(api_key=key)
            for model in ("gemini-2.5-flash", "gemini-1.5-flash"):
                try:
                    resp = client.models.generate_content(model=model, contents=prompt)
                    if resp and getattr(resp, "text", None):
                        return _parse_phase(resp.text.strip()), resp.text.strip()
                except Exception:
                    continue
        except Exception:
            pass
    # Deterministic mock so background jobs never fail offline / keyless.
    worst = max(float(symptoms.get(k, 0) or 0) for k in ("headache", "dizziness", "photophobia", "brain_fog"))
    if worst >= 7:
        phase, limit = "REST_PHASE", 0
    elif worst >= 4:
        phase, limit = "ACTIVE_SUB_SYMPTOM_THRESHOLD", 15
    else:
        phase, limit = "RETURN_TO_WORK_PLAY", 25
    mock = ("%s. Mock specialist guidance (offline): screen limit %d min/session; "
            "dual-task tolerance: %s. Stop any activity if symptoms rise >2 points." % (
                phase.replace("_", " ").title(), limit,
                "none — rest only" if limit == 0 else
                ("light cognitive tasks only" if limit == 15 else "graded dual-task OK")))
    return phase, mock


def _parse_phase(text):
    low = (text or "").lower()
    if "return_to_work_play" in low or "return to work" in low or "graded return" in low:
        return "RETURN_TO_WORK_PLAY"
    if "rest_phase" in low or "acute rest" in low or "full rest" in low:
        return "REST_PHASE"
    return "ACTIVE_SUB_SYMPTOM_THRESHOLD"


def _phase_to_limit(phase):
    return {"STRICT_REST_PROTOCOL": 0, "REST_PHASE": 0,
            "ACTIVE_SUB_SYMPTOM_THRESHOLD": 15, "RETURN_TO_WORK_PLAY": 25}.get(phase, 15)


def _synthesize_binaural_30s(carrier_hz, beat_hz, sr=22050):
    """Synthesize a 30 s stereo binaural buffer; return raw WAV bytes.

    22.05 kHz keeps the base64 payload (~3.5 MB) workflow-friendly while
    remaining fully therapeutic through headphones. A Tukey envelope
    (scipy) guarantees click-free edges.
    """
    n = int(sr * 30.0)
    t = np.arange(n, dtype=np.float64) / sr
    env = tukey(n, alpha=0.05).astype(np.float64) * 0.9 + 0.1
    left = 0.35 * np.sin(2 * np.pi * carrier_hz * t) * env
    right = 0.35 * np.sin(2 * np.pi * (carrier_hz + beat_hz) * t) * env
    pcm = (np.clip(np.stack([left, right], axis=1), -1.0, 1.0) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


# --------------------------------------------------------------------------
# 2-3. CORE IMPLEMENTATION (SDK-independent; always runs synchronously)
# --------------------------------------------------------------------------
def _process_impl(patient_notes, symptoms):
    """Full pipeline: scrub -> Gemini triage -> guardrail -> audio -> dict."""
    symptoms = {k: float((symptoms or {}).get(k, 0) or 0)
                for k in ("headache", "dizziness", "photophobia", "brain_fog")}
    scrubbed = _scrub_phi(patient_notes)

    # a. Clinical analysis via Gemini Flash (or silent mock).
    phase, ai_text = _gemini_analyze(scrubbed, symptoms)

    # b. Deterministic guardrail — code, not the LLM, has the final word.
    override = any(v >= 7 for v in symptoms.values())
    if override:
        phase = "STRICT_REST_PROTOCOL"
        ai_text = ("STRICT_REST_PROTOCOL enforced by the deterministic Safety Gatekeeper "
                   "(a symptom reached 7/10 or higher): full cognitive and physical rest in a "
                   "dark, quiet room — no screens, no exertion. " + ai_text)

    # c. Acoustic synthesis matched to severity.
    worst = max(symptoms.values())
    if worst >= 7:
        carrier, beat = 250.0, 6.0    # Theta — severe fatigue / deep recovery
    else:
        carrier, beat = 432.0, 10.0   # Alpha — mild/moderate calming
    wav_bytes = _synthesize_binaural_30s(carrier, beat)

    # d. Structured return payload.
    return {
        "status": "success",
        "triage_phase": phase,
        "recommendation": ai_text,
        "screen_time_limit_mins": _phase_to_limit(phase),
        "audio_base64": base64.b64encode(wav_bytes).decode("ascii"),
        "responsible_ai_audit": {
            "deterministic_override_triggered": bool(override),
            "phi_scrubbed": True,
        },
    }


# --------------------------------------------------------------------------
# 2. DURABLE WORKFLOW TASK (Render executes this on its infrastructure)
# --------------------------------------------------------------------------
@task
def process_clinical_intake_and_audio(patient_notes: str, symptoms: dict, ctx=None) -> dict:
    """Durable background task: triage + guardrail + binaural synthesis.

    Args:
        patient_notes: Free-text daily check-in from the patient.
        symptoms: Dict with headache / dizziness / photophobia / brain_fog (1-10).
        ctx: Render-injected task context (optional; ignored by core logic).
    """
    return _process_impl(patient_notes, symptoms)


# --------------------------------------------------------------------------
# 4. LOCAL DEV / FALLBACK
# --------------------------------------------------------------------------
def _local_demo():
    """Synchronous smoke test (no workflow infrastructure needed)."""
    demo_notes = ("Slept 6 hours, dull headache this morning. Screens OK ~10 min, "
                  "then eyes ache. Slightly foggy standing up. Email me at jane@example.com or 555-123-4567.")
    demo_symptoms = {"headache": 5, "dizziness": 3, "photophobia": 6, "brain_fog": 4}
    out = _process_impl(demo_notes, demo_symptoms)
    print("status:", out["status"])
    print("triage_phase:", out["triage_phase"])
    print("screen_time_limit_mins:", out["screen_time_limit_mins"])
    print("recommendation:", out["recommendation"][:220])
    print("audio_base64 bytes:", len(out["audio_base64"]), "(starts: %s…)" % out["audio_base64"][:24])
    print("responsible_ai_audit:", out["responsible_ai_audit"])


# --------------------------------------------------------------------------
# 5. WORKER ENTRYPOINT
# --------------------------------------------------------------------------
if __name__ == "__main__":
    if "--local" in sys.argv or not _HAS_WORKFLOWS:
        # Synchronous path: local dev without Render infrastructure.
        _local_demo()
    else:
        start()
