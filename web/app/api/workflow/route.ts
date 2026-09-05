import { NextResponse } from "next/server";

/**
 * POST /api/workflow : async trigger for the Render Workflow backend.
 *
 * The UI must never freeze on heavy inference or audio synthesis, so this
 * route only enqueues work and instantly returns a job id:
 *
 *   Production path (RENDER_API_KEY + WORKFLOW_SLUG set):
 *     POST https://api.render.com/v1/task-runs
 *     { task: "<slug>/clinical_pacing_task", input: [{ note, symptoms }] }
 *   which starts `clinical_pacing_task` in render_worker.py on Render infra.
 *
 *   Local path: returns a lightweight job id immediately; the worker can be
 *   exercised synchronously with `python render_worker.py --local`.
 *
 * GET /api/workflow?jobId=… : status probe used by the live status badge.
 * Remote runs are queried against the Render API; local jobs flip to
 * complete a few seconds after creation (enough for the demo loop).
 */

function mockJobId(): string {
  const stamp = Date.now().toString(36);
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `local-${stamp}-${rand}`;
}

function localComplete(jobId: string): boolean {
  const part = jobId.split("-")[1] ?? "";
  const created = parseInt(part, 36);
  if (!Number.isFinite(created)) return true;
  return Date.now() - created > 6000;
}

export async function POST(req: Request) {
  let note = "";
  let symptoms: Record<string, unknown> = {};
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.note === "string") note = body.note.slice(0, 2000);
    if (typeof body.patientNotes === "string") note = body.patientNotes.slice(0, 2000);
    const s = body.symptoms ?? body.scores;
    if (s && typeof s === "object") symptoms = s as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const jobId = mockJobId();
  const slug = process.env.WORKFLOW_SLUG;
  const apiKey = process.env.RENDER_API_KEY;

  if (slug && apiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("https://api.render.com/v1/task-runs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task: `${slug}/clinical_pacing_task`,
          input: [{ note, symptoms }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const remoteId =
          typeof data.id === "string"
            ? data.id
            : typeof data.runId === "string"
              ? data.runId
              : jobId;
        return NextResponse.json({ jobId: remoteId, mode: "render" }, { status: 202 });
      }
    } catch {
      /* Render unreachable: fall through to the local job below */
    }
  }

  return NextResponse.json({ jobId, mode: "local" }, { status: 202 });
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId") ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const slug = process.env.WORKFLOW_SLUG;
  const apiKey = process.env.RENDER_API_KEY;
  if (slug && apiKey && !jobId.startsWith("local-")) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://api.render.com/v1/task-runs/${encodeURIComponent(jobId)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const status = String(data.status ?? data.state ?? "running").toLowerCase();
        const done = ["succeeded", "success", "complete", "completed"].includes(status);
        return NextResponse.json({
          jobId,
          status: done ? "complete" : "running",
          mode: "render",
        });
      }
    } catch {
      /* fall through to the simulated answer */
    }
  }

  return NextResponse.json({
    jobId,
    status: localComplete(jobId) ? "complete" : "running",
    mode: "local",
  });
}
