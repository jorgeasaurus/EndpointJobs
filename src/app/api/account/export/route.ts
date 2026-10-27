import { buildAccountExport } from "@/lib/account/records";
import { requireAccountUser } from "@/lib/account/require-user";

export async function GET() {
  const session = await requireAccountUser();
  if (!session) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { supabase, user } = session;
  const [profile, preferences, savedJobs, jobViews] = await Promise.all([
    supabase.from("profiles").select("id, email, created_at, privacy_version_accepted").eq("id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("filters, schema_version, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("saved_jobs").select("job_id, job_snapshot, saved_at").eq("user_id", user.id),
    supabase.from("job_views").select("job_id, first_viewed_at, last_viewed_at, view_count").eq("user_id", user.id)
  ]);

  const document = buildAccountExport({
    exportedAt: new Date().toISOString(),
    profile: profile.data,
    preferences: preferences.data,
    savedJobs: savedJobs.data ?? [],
    jobViews: jobViews.data ?? []
  });

  return new Response(JSON.stringify(document, null, 2), {
    headers: {
      "cache-control": "no-store",
      "content-disposition": "attachment; filename=\"endpoint-jobs-account.json\"",
      "content-type": "application/json; charset=utf-8"
    }
  });
}
