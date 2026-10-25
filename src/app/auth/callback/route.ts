import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { PRIVACY_POLICY_VERSION } from "@/app/privacy/version";
import { safeRedirectUrl } from "@/lib/auth/safe-next-path";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function emailFromUser(user: User): string | null {
  if (typeof user.email === "string" && user.email.trim()) return user.email.trim();
  for (const identity of user.identities ?? []) {
    const value = identity.identity_data?.email;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = safeRedirectUrl(url.origin, url.searchParams.get("next"));
  const home = new URL("/", url.origin);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(home);
  }

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(home);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data.user ? emailFromUser(data.user) : null;
  if (error || !data.user || !email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(home);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: data.user.id,
      email,
      privacy_version_accepted: PRIVACY_POLICY_VERSION
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(home);
  }

  return NextResponse.redirect(destination);
}
