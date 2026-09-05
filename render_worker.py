"""
NeuroPath - Render Workflow worker (Best Use of Render track).

Runs `python render_worker.py`, which serves the durable task registry via
`render_sdk.workflows.start()`. The Next.js frontend triggers runs through
POST /api/workflow and polls GET /api/workflow until the run completes.

Local equivalents:
    python render_worker.py --local     (synchronous smoke test)
    render workflows dev                (local task server)
"""
import base64
import io
import os
import re
import sys
import wave

import numpy as np
from scipy.signal.windows import tukey

try:
    from render_sdk.workflows import start, task
    _HAS_WORKFLOWS = True
except ImportError:
    try:
        from render.workflows import start, task
        _HAS_WORKFLOWS = True
    except ImportError:
        _HAS_WORKFLOWS = False

        def task(_func=None, **kwargs):
            def _wrap(fn):
                return fn
            return _wrap(_func) if callable(_func) else _wrap

        def start():
            print("[render_worker] render_sdk missing. pip install render-sdk")
            if "--local" in sys.argv:
                _local_demo()


def _key():
    return (os.getenv("GEMINI_API_KEY") or "").strip()


def _scrub(text):
    clean = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[EMAIL]", text or "")
    clean = re.sub(r"\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}", "[PHONE]", clean)
    return clean.strip()


def _gemini_plan(notes, symptoms):
    """Ask Gemini Flash for a detailed clinical pacing plan (silent mock fallback)."""
    prompt = (
        "You are a board-level neurorehabilitation specialist writing a pacing plan "
        "for a recovery app. Patient note: '%s'. Scores /10: headache %s, dizziness %s, "
        "photophobia %s, brain fog %s. Write 4 short sections with plain headers: "
        "STATUS (one of REST_PHASE, ACTIVE_SUB_SYMPTOM, RETURN_GRADED), SCREEN_LIMIT "
        "(minutes per session, integer), DUAL_TASK (one line on dual-task tolerance), "
        "CAUTIONS (one line). Calm clinical tone, under 130 words, no drug or "
        "definitive diagnostic claims." % (
            notes or "No note provided.",
            symptoms.get("headache"), symptoms.get("dizziness"),
            symptoms.get("photophobia"), symptoms.get("brain_fog")))
    key = _key()
    if key:
        try:
            from google import genai
            client = genai.Client(api_key=key)
            for model in ("gemini-2.5-flash", "gemini-1.5-flash"):
                try:
                    resp = client.models.generate_content(model=model, contents=prompt)
                    if resp and getattr(resp, "text", None):
                        return resp.text.strip()
                except Exception:
                    continue
        except Exception:
            pass
    worst = max(float(symptoms.get(k, 0) or 0) for k in ("headache", "dizziness", "photophobia", "brain_fog"))
    phase = "REST_PHASE" if worst >= 7 else ("ACTIVE_SUB_SYMPTOM" if worst >= 4 else "RETURN_GRADED")
    limit = 0 if worst >= 7 else (15 if worst >= 4 else 25)
    return ("STATUS: %s (offline mock). SCREEN_LIMIT: %d. DUAL_TASK: %s. CAUTIONS: "
            "Stop any activity if symptoms rise more than 2 points." % (
                phase, limit,
                "none, rest only" if limit == 0 else (
                    "light cognitive tasks only" if limit == 15 else "graded dual-task OK")))


def _synth_30s(carrier_hz, beat_hz, sr=22050):
    """Synthesize a 30 second stereo binaural buffer, returned as WAV bytes."""
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


def _run_impl(patient_json):
    """Shared core: scrub, plan, guardrail, synthesize, return payload."""
    data = patient_json or {}
    symptoms = {k: float(data.get(k, data.get("symptoms", {}).get(k, 0)) or 0)
                for k in ("headache", "dizziness", "photophobia", "brain_fog")}
    notes = _scrub(str(data.get("note", data.get("patientNotes", ""))))
    plan = _gemini_plan(notes, symptoms)

    override = any(v >= 7 for v in symptoms.values())
    if override:
        plan = ("STRICT_REST_PROTOCOL enforced by the deterministic Safety Gatekeeper "
                "(a symptom reached 7 or higher): full rest, dark quiet room, audio only. " + plan)

    worst = max(symptoms.values())
    carrier, beat = (250.0, 6.0) if worst >= 7 else (432.0, 10.0)
    audio_b64 = base64.b64encode(_synth_30s(carrier, beat)).decode("ascii")
    return {
        "status": "success",
        "pacing_plan": plan,
        "audio_base64": audio_b64,
        "audio_protocol": "theta-250hz-6" if worst >= 7 else "alpha-432hz-10",
        "screen_time_limit_mins": 0 if override else (15 if worst >= 4 else 25),
        "responsible_ai_audit": {
            "deterministic_override_triggered": bool(override),
            "phi_scrubbed": True,
        },
    }


@task
def clinical_pacing_task(patient_json: dict, ctx=None) -> dict:
    """Durable background task: pacing plan plus custom audio buffer.

    Triggered remotely with: run_task("neuropath-workflow/clinical_pacing_task",
    [patient_json]). The ctx slot carries Render-injected run context.
    """
    return _run_impl(patient_json)


def _local_demo():
    out = _run_impl({"note": "Dull headache, screens OK briefly.", "headache": 5,
                     "dizziness": 3, "photophobia": 6, "brain_fog": 4})
    print("status:", out["status"])
    print("protocol:", out["audio_protocol"], "| limit:", out["screen_time_limit_mins"])
    print("plan:", out["pacing_plan"][:200])
    print("audio_base64 bytes:", len(out["audio_base64"]))
    print("audit:", out["responsible_ai_audit"])


if __name__ == "__main__":
    if "--local" in sys.argv or not _HAS_WORKFLOWS:
        _local_demo()
    else:
        start()
