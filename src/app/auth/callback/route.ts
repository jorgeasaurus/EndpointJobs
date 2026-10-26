import { NextResponse } from "next/server";

import { handleAuthCallback } from "@/lib/auth/callback-session";
import { saveProfileOnSignIn } from "@/lib/auth/profile-consent";
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
    upsertProfile: (profile) =>
      saveProfileOnSignIn({
        profile,
        insertProfile: async (row) => {
          const { error } = await supabase.from("profiles").insert({
            id: row.id,
            email: row.email,
            privacy_version_accepted: row.privacyVersion
          });
          return { error };
        },
        updateEmail: async (id, email) => {
          const { data, error } = await supabase.from("profiles").update({ email }).eq("id", id).select("id");
          if (error) return { error };
          if (!data?.length) return { error: new Error("profile email was not updated") };
          return { error: null };
        }
      }),
    signOutLocal: () => supabase.auth.signOut({ scope: "local" })
  });

  return NextResponse.redirect(redirectTo);
}
