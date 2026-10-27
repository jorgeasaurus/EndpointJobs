import { requireAccountUser } from "@/lib/account/require-user";

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
