import { decodePreferences, preferenceRow } from "@/lib/account/preferences";
import { requireAccountUser } from "@/lib/account/require-user";

// The body is the encoded preferences record the board saves. Unknown keys are
// dropped and missing ones take their defaults, so `{}` stores the defaults.
export async function PUT(request: Request) {
  const session = await requireAccountUser();
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });

  const preferences = decodePreferences(await request.json().catch(() => null));
  if (!preferences) return Response.json({ error: "Preferences must be a JSON object" }, { status: 400 });

  const { error } = await session.supabase
    .from("user_preferences")
    .upsert(preferenceRow(session.user.id, preferences, new Date().toISOString()), { onConflict: "user_id" });
  if (error) return Response.json({ error: "Preferences could not be saved" }, { status: 500 });
  return Response.json({ saved: true });
}
