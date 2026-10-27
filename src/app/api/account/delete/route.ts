import { NextResponse } from "next/server";

import { deletionConfirmed } from "@/lib/account/records";
import { requireAccountUser } from "@/lib/account/require-user";
import { authCookiesToClear } from "@/lib/auth/sign-out-navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await requireAccountUser();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (!deletionConfirmed(body?.confirmation)) {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(session.user.id);
    if (error) {
      return NextResponse.json({ error: "Account could not be deleted" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Account deletion is not configured" }, { status: 503 });
  }

  try {
    await session.supabase.auth.signOut({ scope: "local" });
  } catch {
    // The auth user is already gone, so the local revoke can fail. The cookies
    // are expired on this response either way.
  }

  const response = NextResponse.json({ deleted: true });
  for (const name of authCookiesToClear(request.headers.get("cookie"))) {
    response.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax", httpOnly: false });
  }
  return response;
}
