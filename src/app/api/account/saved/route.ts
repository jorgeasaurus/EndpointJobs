import feedData from "@/data/jobs.json";
import { savedJobSnapshot } from "@/lib/account/records";
import { requireAccountUser } from "@/lib/account/require-user";
import { findActiveJob } from "@/lib/jobs-api";
import type { JobsFeed } from "@/types/job";

const feed = feedData as JobsFeed;

export async function POST(request: Request) {
  const session = await requireAccountUser();
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const job = findActiveJob(feed, jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const { error } = await session.supabase.from("saved_jobs").upsert({
    user_id: session.user.id,
    job_id: job.id,
    job_snapshot: savedJobSnapshot(job),
    saved_at: new Date().toISOString()
  }, { onConflict: "user_id,job_id" });

  if (error) return Response.json({ error: "Job could not be saved" }, { status: 500 });
  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const session = await requireAccountUser();
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
  if (!jobId) return Response.json({ error: "Job id required" }, { status: 400 });

  const { error } = await session.supabase.from("saved_jobs").delete().eq("user_id", session.user.id).eq("job_id", jobId);
  if (error) return Response.json({ error: "Job could not be removed" }, { status: 500 });
  return Response.json({ saved: false });
}
