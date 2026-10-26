import { NextResponse } from "next/server";

import { signOutRedirectDecision, signOutRedirectUrl, signOutRequestAllowed } from "@/lib/auth/sign-out-navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (
    !signOutRequestAllowed(request.headers.get("host"), {
      origin: request.headers.get("origin"),
      site: request.headers.get("sec-fetch-site")
    })
  ) {
    return new NextResponse("Sign out must come from this site", { status: 403 });
  }

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    let stillSignedIn = false;
    if (error) {
      try {
        const { data } = await supabase.auth.getClaims();
        stillSignedIn = typeof data?.claims?.sub === "string" && data.claims.sub.length > 0;
      } catch {
        stillSignedIn = true;
      }
    }
    if (signOutRedirectDecision({ error, stillSignedIn }) === "unavailable") {
      return new NextResponse("Sign out failed", { status: 503 });
    }
  }

  return NextResponse.redirect(signOutRedirectUrl(request.url), 303);
}
