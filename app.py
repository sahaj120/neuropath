"""
NeuroPath — Active Neuro-Rehabilitation Engine (Streamlit frontend).
Obsidian-glass theme. Triggers the durable Render Workflow in workflow.py.

Secrets: read ONLY from environment / st.secrets inside workflow.py.
This file contains zero API key inputs and never displays secrets.

Screens:
  1. Conversational Check-In (NeuroIntake) -> background workflow execution
  2. Low-Stimulation Saccade Visual Pacing (with emergency pause)
  3. Responsible AI & Render Architecture Panel
Run: streamlit run app.py
"""
import base64
from datetime import datetime

import streamlit as st
import streamlit.components.v1 as components

# The durable background task (Render Workflows registry handle) plus its
# synchronously-executable core. On Render infrastructure the same registered
# function runs durably on the workflow worker (python workflow.py -> start());
# the frontend invokes the registered handle's bound function so both paths
# share one code path and one return contract.
try:
    from workflow import _process_impl, process_clinical_intake_and_audio
    _TASK_NAME = getattr(process_clinical_intake_and_audio, "name",
                         "process_clinical_intake_and_audio")
except ImportError:
    _process_impl = None
    process_clinical_intake_and_audio = None
    _TASK_NAME = "process_clinical_intake_and_audio (unavailable)"

st.set_page_config(page_title="NeuroPath | Active Neuro-Rehabilitation Engine",
                   page_icon="🧠", layout="wide", initial_sidebar_state="collapsed")

# --------------------------------------------------------------------------
# 1. OBSIDIAN-GLASS THEME (photophobia-safe, no chrome, no key fields)
# --------------------------------------------------------------------------
CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
html, body, .stApp { background: #0B0F17 !important; color: #E6EDF3 !important;
  font-family: 'Inter', system-ui, sans-serif; }
div[data-testid="stAppViewContainer"] > .main > div { padding-top: 0.8rem !important;
  padding-left: 2rem !important; padding-right: 2rem !important; }
header[data-testid="stHeader"] { background: rgba(11,15,23,0) !important; }
footer, #MainMenu, div[data-testid="stToolbar"], div[data-testid="stDecoration"],
div[data-testid="stStatusWidget"] { display: none !important; }
.np-hero { font-size: 1.9rem; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: #E6EDF3; }
.np-hero .accent { background: linear-gradient(90deg, #06B6D4, #10B981);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.np-sub { color: #8B9BB0; font-size: 0.95rem; margin-top: 2px; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px;
  border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid #1E293B; }
.pill-live { background: rgba(16,185,129,0.12); color: #34D399; border-color: rgba(16,185,129,0.35); }
.pill-live .dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981;
  box-shadow: 0 0 8px #10B981; animation: pulse 1.8s infinite; }
.pill-rest { background: rgba(239,68,68,0.12); color: #FCA5A5; border-color: rgba(239,68,68,0.4); }
.pill-cyan { background: rgba(6,182,212,0.12); color: #67E8F9; border-color: rgba(6,182,212,0.35); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
.glass { background: rgba(19,27,46,0.66); backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(6,182,212,0.28);
  border-radius: 18px; padding: 22px 24px;
  box-shadow: 0 8px 40px rgba(6,182,212,0.10), 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 16px; }
.glass h4 { margin: 0 0 8px 0; color: #67E8F9; }
.np-card { background: #131B2E; border: 1px solid #1E293B; border-radius: 16px;
  padding: 20px 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); margin-bottom: 16px; }
.np-banner { background: linear-gradient(90deg, rgba(6,182,212,0.10), rgba(16,185,129,0.10));
  border: 1px solid #1E293B; border-left: 4px solid #06B6D4; border-radius: 12px;
  padding: 11px 18px; color: #B9C4D4; font-size: 0.88rem; margin: 14px 0 20px 0; }
.np-danger { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.55);
  border-radius: 14px; padding: 14px 18px; margin: 12px 0; }
.screen-tag { display: inline-block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
  color: #06B6D4; text-transform: uppercase; margin-bottom: 2px; }
div.stButton > button { border-radius: 12px !important; font-weight: 700 !important;
  border: 1px solid #1E293B !important; }
div.stButton > button[kind="primary"] { background: linear-gradient(90deg, #06B6D4, #10B981) !important;
  color: #04121A !important; border: none !important; box-shadow: 0 6px 22px rgba(6,182,212,0.35); }
div[data-testid="stSlider"] label, div[data-testid="stTextArea"] label { color: #C7D2E0 !important; font-weight: 600; }
textarea { background: #0B0F17 !important; color: #E6EDF3 !important;
  border: 1px solid #1E293B !important; border-radius: 12px !important; }
.arch-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
.arch-chip { background: #0B0F17; border: 1px solid #1E293B; border-radius: 12px;
  padding: 12px 16px; min-width: 200px; flex: 1; }
.arch-chip .k { font-size: 0.7rem; color: #06B6D4; text-transform: uppercase;
  letter-spacing: 0.06em; font-weight: 700; }
.arch-chip .v { font-size: 0.92rem; color: #E6EDF3; margin-top: 4px; }
</style>
"""
st.markdown(CSS, unsafe_allow_html=True)

# --------------------------------------------------------------------------
# SESSION STATE
# --------------------------------------------------------------------------
def _init():
    d = {"intake_text": "", "s_head": 3, "s_dizz": 3, "s_fog": 3, "s_light": 3,
         "wf_result": None, "wf_error": "",
         "sac_running": False, "sac_start": 0.0, "sac_log": [],
         "sac_pattern": "Horizontal", "sac_speed": "Slow"}
    for k, v in d.items():
        if k not in st.session_state:
            st.session_state[k] = v
_init()

# --------------------------------------------------------------------------
# HEADER — identity + live status badge (no secrets anywhere in UI)
# --------------------------------------------------------------------------
h1, h2 = st.columns([4, 1])
with h1:
    st.markdown('<div class="np-hero">NeuroPath <span class="accent">| Active Neuro-Rehabilitation Engine</span></div>',
                unsafe_allow_html=True)
    st.markdown('<div class="np-sub">Durable clinical pacing, synthesized sound therapy & gentle visual rehab.</div>',
                unsafe_allow_html=True)
with h2:
    st.markdown("<div style='text-align:right; padding-top:16px;'>", unsafe_allow_html=True)
    res = st.session_state.wf_result
    if res and res.get("triage_phase") == "STRICT_REST_PROTOCOL":
        st.markdown("<span class='pill pill-rest'>🛌 Safety Rest Active</span>", unsafe_allow_html=True)
    elif res:
        st.markdown("<span class='pill pill-live'><span class='dot'></span> Session Active</span>", unsafe_allow_html=True)
    else:
        st.markdown("<span class='pill pill-live'><span class='dot'></span> Engine Online</span>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

st.markdown("<div class='np-banner'><b>Hackathon Prototype — non-diagnostic.</b> "
            "All processing is local-first; webcam/canvas frames are discarded immediately. "
            "No health data leaves this session.</div>", unsafe_allow_html=True)

# --------------------------------------------------------------------------
# SCREEN 1 — CONVERSATIONAL CHECK-IN (NeuroIntake)
# --------------------------------------------------------------------------
st.markdown("<span class='screen-tag'>Screen 1 · NeuroIntake</span>", unsafe_allow_html=True)
st.markdown("### 💬 Daily Check-In")
st.markdown("<div class='np-card'>", unsafe_allow_html=True)
note = st.text_area("Describe how your head, energy, and sleep feel today.",
                    value=st.session_state.intake_text, height=110,
                    placeholder="e.g., Dull headache since morning, slept 6 hours, screens feel okay for ~10 minutes…")
st.session_state.intake_text = note
c1, c2, c3, c4 = st.columns(4)
with c1:
    st.session_state.s_head = st.slider("Headache", 1, 10, st.session_state.s_head)
with c2:
    st.session_state.s_dizz = st.slider("Dizziness", 1, 10, st.session_state.s_dizz)
with c3:
    st.session_state.s_fog = st.slider("Brain Fog", 1, 10, st.session_state.s_fog)
with c4:
    st.session_state.s_light = st.slider("Light Sensitivity", 1, 10, st.session_state.s_light)
st.markdown("</div>", unsafe_allow_html=True)

if st.button("✨ Analyze & Generate Recovery Session", type="primary", use_container_width=True):
    symptoms = {"headache": st.session_state.s_head, "dizziness": st.session_state.s_dizz,
                "photophobia": st.session_state.s_light, "brain_fog": st.session_state.s_fog}
    with st.spinner("Executing durable clinical intake on Render Workflows..."):
        try:
            if process_clinical_intake_and_audio is not None and hasattr(process_clinical_intake_and_audio, "func"):
                # Trigger through the registered Render Workflow task handle:
                # the durable worker runs this same bound function on Render infra.
                st.session_state.wf_result = process_clinical_intake_and_audio.func(
                    st.session_state.intake_text, symptoms)
            elif _process_impl is not None:
                st.session_state.wf_result = _process_impl(st.session_state.intake_text, symptoms)
            else:
                raise RuntimeError("workflow engine unavailable")
            st.session_state.wf_error = ""
        except Exception as exc:
            st.session_state.wf_result = None
            st.session_state.wf_error = str(exc)[:200]
    st.rerun()

if st.session_state.wf_error:
    st.error("Workflow execution failed: %s" % st.session_state.wf_error)

# Render the returned pacing plan inside a glass card + decoded audio player.
res = st.session_state.wf_result
if res:
    phase = res.get("triage_phase", "—")
    audit = res.get("responsible_ai_audit", {})
    badge = "pill-rest" if phase == "STRICT_REST_PROTOCOL" else "pill-cyan"
    st.markdown("<div class='glass'><h4>🧬 Your Clinical Pacing Plan — %s</h4>" % phase,
                unsafe_allow_html=True)
    st.markdown("<span class='pill %s'>%s</span> "
                "<span class='pill pill-cyan'>⏱ %s min screen limit</span> "
                "<span class='pill pill-live'><span class='dot'></span> Render Workflow · %s</span>" % (
                    badge, phase, res.get("screen_time_limit_mins", "—"), _TASK_NAME),
                unsafe_allow_html=True)
    st.write(res.get("recommendation", ""))
    if audit.get("deterministic_override_triggered"):
        st.markdown("<div class='np-danger'>🛌 <b>Safety Gatekeeper override engaged</b> — a symptom reached "
                    "7/10+, so strict rest is enforced regardless of AI output. Screens off, dark quiet room, "
                    "audio therapy only.</div>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

    b64 = res.get("audio_base64") or ""
    if b64:
        try:
            st.caption("🎧 Your prescribed 30-second binaural soundscape (synthesized in the background task)")
            st.audio(base64.b64decode(b64), format="audio/wav")
        except Exception:
            st.caption("Audio buffer could not be decoded in this browser.")
    else:
        st.caption("No audio buffer was returned with this session.")

    txt = "\n".join([
        "NEUROPATH — RECOVERY SESSION PLAN (%s)" % datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Phase: %s | Screen limit: %s min" % (phase, res.get("screen_time_limit_mins", "—")),
        "Check-in: headache %d, dizziness %d, fog %d, light %d" % (
            st.session_state.s_head, st.session_state.s_dizz,
            st.session_state.s_fog, st.session_state.s_light),
        "Note: %s" % (st.session_state.intake_text.strip() or "(none)"),
        "", str(res.get("recommendation", "")),
        "", "Non-diagnostic prototype. Confirm with a licensed clinician.",
    ])
    st.download_button("⬇️ Download Pacing Plan (TXT)", txt.encode("utf-8"),
                       file_name="neuropath_plan_%s.txt" % datetime.now().strftime("%Y%m%d_%H%M%S"),
                       mime="text/plain")

st.markdown("---")

# --------------------------------------------------------------------------
# SCREEN 2 — LOW-STIMULATION SACCADE VISUAL PACING
# --------------------------------------------------------------------------
st.markdown("<span class='screen-tag'>Screen 2 · Visual Pacing</span>", unsafe_allow_html=True)
st.markdown("### 👁️ Saccade Visual Pacing")
st.write("Optional vestibular-ocular calibration: follow the soft glowing dot with your **eyes only** — head still, dim room.")


def _saccade_html(mode_key, period_s):
    html = """
<div style="background:#0B0F17;border:1px solid #1E293B;border-radius:16px;padding:12px 14px;">
<div style="display:flex;justify-content:space-between;color:#8B9BB0;font-size:13px;margin-bottom:6px;">
<span>MODELABEL · low-contrast pursuit</span>
<span>Comfort timer: <b id="sacT" style="color:#67E8F9;">0.0s</b></span></div>
<canvas id="sac" width="900" height="360" style="width:100%;border-radius:12px;background:#0B0F17;display:block;"></canvas>
<div style="color:#5B6B80;font-size:12px;margin-top:6px;">Eyes only — pause immediately if symptoms rise.</div>
</div>
<script>
(function(){
var c=document.getElementById('sac'),x=c.getContext('2d'),t0=performance.now();
var W=c.width,H=c.height,cx=W/2,cy=H/2,AX=W*0.34,AY=H*0.30;
var mode='MODEKEY',T=PERIODS;
function dot(px,py){
x.clearRect(0,0,W,H);
x.strokeStyle='rgba(139,155,176,0.20)';x.lineWidth=1;
x.beginPath();x.moveTo(cx-AX-24,cy);x.lineTo(cx+AX+24,cy);x.stroke();
var g=x.createRadialGradient(px,py,2,px,py,24);
g.addColorStop(0,'rgba(165,243,252,0.9)');g.addColorStop(0.4,'rgba(103,232,249,0.45)');
g.addColorStop(1,'rgba(103,232,249,0)');
x.fillStyle=g;x.beginPath();x.arc(px,py,24,0,7);x.fill();
x.fillStyle='#E6EDF3';x.beginPath();x.arc(px,py,5,0,7);x.fill();
}
function frame(now){
var e=(now-t0)/1000;
document.getElementById('sacT').textContent=e.toFixed(1)+'s';
var px=cx,py=cy,ph=(e%T)/T*2*Math.PI;
if(mode==='h'){px=cx+AX*Math.sin(ph);}
else if(mode==='v'){py=cy+AY*Math.sin(ph);}
else{px=cx+AX*Math.sin(ph);py=cy+AY*Math.cos(ph);}
dot(px,py);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
</script>
"""
    labels = {"h": "Smooth pursuit — horizontal", "v": "Smooth pursuit — vertical",
              "d": "Smooth pursuit — diagonal"}
    return html.replace("MODEKEY", mode_key).replace("PERIODS", str(float(period_s))).replace(
        "MODELABEL", labels.get(mode_key, "Smooth pursuit"))


rest_lock = bool(res and res.get("triage_phase") == "STRICT_REST_PROTOCOL")
if rest_lock:
    st.markdown("<div class='np-danger'>🔒 <b>Paused under Safety Rest Protocol.</b> "
                "Visual tracking needs symptom scores below 7/10 — please rest or replay your audio therapy above.</div>",
                unsafe_allow_html=True)
else:
    p1, p2 = st.columns(2)
    with p1:
        st.session_state.sac_pattern = st.selectbox("Tracking direction",
            ["Horizontal", "Vertical", "Diagonal"],
            index=["Horizontal", "Vertical", "Diagonal"].index(st.session_state.sac_pattern),
            disabled=st.session_state.sac_running)
    with p2:
        st.session_state.sac_speed = st.radio("Pacing speed", ["Slow", "Moderate"],
            index=0 if st.session_state.sac_speed == "Slow" else 1,
            horizontal=True, disabled=st.session_state.sac_running)
    import time as _time
    b1, b2 = st.columns(2)
    with b1:
        if st.button("▶ Begin Visual Pacing", type="primary", use_container_width=True,
                     disabled=st.session_state.sac_running):
            import time
            st.session_state.sac_running = True
            st.session_state.sac_start = time.time()
            st.rerun()
    with b2:
        if st.button("⏸ EMERGENCY PAUSE — STOP EXERCISE", use_container_width=True,
                     disabled=not st.session_state.sac_running):
            import time
            dur = time.time() - (st.session_state.sac_start or time.time())
            st.session_state.sac_log.append({
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "pattern": st.session_state.sac_pattern, "speed": st.session_state.sac_speed,
                "duration_s": round(max(dur, 0.0), 1), "outcome": "emergency-pause"})
            st.session_state.sac_running = False
            st.rerun()
    if st.session_state.sac_running:
        st.markdown("<div class='np-danger'>⚠️ <b>Feeling worse?</b> Hit "
                    "<b>EMERGENCY PAUSE</b> immediately — dizziness or nausea means stop and rest.</div>",
                    unsafe_allow_html=True)
        mode_map = {"Horizontal": "h", "Vertical": "v", "Diagonal": "d"}
        period = 10.0 if st.session_state.sac_speed == "Slow" else 6.0
        components.html(_saccade_html(mode_map[st.session_state.sac_pattern], period), height=480)
        if st.button("✅ Complete Interval", use_container_width=True):
            import time
            dur = time.time() - (st.session_state.sac_start or time.time())
            st.session_state.sac_log.append({
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "pattern": st.session_state.sac_pattern, "speed": st.session_state.sac_speed,
                "duration_s": round(max(dur, 0.0), 1), "outcome": "completed"})
            st.session_state.sac_running = False
            st.rerun()
    if st.session_state.sac_log:
        m1, m2 = st.columns(2)
        m1.metric("Intervals logged", str(len(st.session_state.sac_log)))
        m2.metric("Total tracked", "%.0f s" % sum(e["duration_s"] for e in st.session_state.sac_log))

st.markdown("---")

# --------------------------------------------------------------------------
# SCREEN 3 — RESPONSIBLE AI & RENDER ARCHITECTURE PANEL
# --------------------------------------------------------------------------
st.markdown("<span class='screen-tag'>Screen 3 · Architecture</span>", unsafe_allow_html=True)
st.markdown("### 🏛️ Responsible AI & Render Architecture")
st.markdown("<div class='glass'><h4>How NeuroPath runs on Render</h4>"
            "<div class='arch-grid'>"
            "<div class='arch-chip'><div class='k'>Frontend</div>"
            "<div class='v'>Streamlit on a Render Web Service — obsidian-glass UI, zero secrets in the browser.</div></div>"
            "<div class='arch-chip'><div class='k'>Distributed Task</div>"
            "<div class='v'>Render Workflows SDK (<b>%s</b>) orchestrating Gemini Flash inference + NumPy binaural synthesis in a durable background task.</div></div>"
            "<div class='arch-chip'><div class='k'>Privacy</div>"
            "<div class='v'>Zero data retention — ephemeral local state only, PHI scrubbed pre-inference, nothing persisted remotely (HIPAA-aligned).</div></div>"
            "</div></div>" % _TASK_NAME, unsafe_allow_html=True)

with st.expander("🔍 Responsible AI Safeguards"):
    st.markdown("**Zero Data Retention.** No PII or health logs transmitted or stored remotely; "
                "frames and audio buffers live in local memory and are discarded. Keys load server-side only.")
    st.markdown("**Clinical Safety Boundary.** Sub-symptom-threshold pacing per the Berlin Concussion Consensus; "
                "no pharmacological or diagnostic claims — supportive guidance only, labelled prototype.")
    st.markdown("**Deterministic Override.** Any symptom ≥ 7/10 forces STRICT_REST_PROTOCOL in code — "
                "the LLM can never waive it; strenuous modules lock and only audio therapy remains.")
    st.caption("Hackathon Prototype — not medical advice. Confirm with a licensed clinician.")
