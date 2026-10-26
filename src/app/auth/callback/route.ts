import { NextResponse } from "next/server";

import { handleAuthCallback } from "@/lib/auth/callback-session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const home = new URL("/", request.url);
  if (!isSupabaseConfigured()) return NextResponse.redirect(home);

  const supabase = await createClient();
  const redirectTo = await handleAuthCallback({
    requestUrl: request.url,
    exchangeCode: async (code) => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      return { error, user: data.user };
    },
    upsertProfile: async (profile) => {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: profile.id,
          email: profile.email,
          privacy_version_accepted: profile.privacyVersion
        },
        { onConflict: "id" }
      );
      return { error };
    },
    signOutLocal: () => supabase.auth.signOut({ scope: "local" })
  });

  return NextResponse.redirect(redirectTo);
}
