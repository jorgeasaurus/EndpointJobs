import { deletionConfirmed } from "@/lib/account/records";
import { requireAccountUser } from "@/lib/account/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await requireAccountUser();
  if (!session) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (!deletionConfirmed(body?.confirmation)) {
    return Response.json({ error: "Confirmation required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(session.user.id);
    if (error) {
      return Response.json({ error: "Account could not be deleted" }, { status: 500 });
    }
  } catch {
    return Response.json({ error: "Account deletion is not configured" }, { status: 503 });
  }

  return Response.json({ deleted: true });
}
