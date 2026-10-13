# NeuroPath

An AI-powered neuro-recovery web app built for users dealing with post-concussion syndrome, ADHD, and sensory overload. It uses the Gemini API to take plain text symptom inputs and dynamically adjust the UI, pacing, and audio therapy to reduce cognitive friction. 

**Winner:** Best Use of Render at Hack for Humanity Summer 2026.

## Tech Stack
* **Core:** Next.js 14, React, TypeScript
* **Styling & UI:** Tailwind CSS, Framer Motion
* **AI:** Google Gemini API
* **Audio:** `react-player` (headless YouTube streaming)
* **Deployment:** Render Web Service & Workflows

## Features
* **AI Triage:** Gemini interprets symptom severity from natural language and outputs a strict JSON state.
* **Dynamic Environment:** UI automatically shifts color palettes (e.g., high contrast amber for photophobia) based on the AI assessment.
* **Automated Audio Therapy:** Streams specific therapeutic frequencies (like 108Hz delta waves) in the background without user intervention.
* **Vestibular Saccadic Trainer:** Eye-tracking module with a dynamic velocity decay equation `V(S) = V_base * e^(-k * S)` calibrated to the user's reported dizziness.
* **Cognitive Anchoring:** Integrated 5-4-3-2-1 grounding protocol and a single task executive function primer.




