import { requireAccountUser } from "@/lib/account/require-user";

export async function POST(request: Request) {
  const session = await requireAccountUser();
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  if (!jobId) return Response.json({ error: "Job id required" }, { status: 400 });

  // record_job_view takes the user from auth.uid(), so a session records only its own views.
  const { error } = await session.supabase.rpc("record_job_view", { p_job_id: jobId });
  if (error) return Response.json({ error: "View could not be recorded" }, { status: 500 });
  return Response.json({ recorded: true });
}

export async function DELETE() {
  const session = await requireAccountUser();
  if (!session) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { error } = await session.supabase.from("job_views").delete().eq("user_id", session.user.id);
  if (error) {
    return Response.json({ error: "View history could not be cleared" }, { status: 500 });
  }

  return Response.json({ cleared: true });
}
