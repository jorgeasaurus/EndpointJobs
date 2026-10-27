import { NextResponse } from "next/server";

import { authCookiesToClear, signOutRedirectUrl, signOutRequestAllowed } from "@/lib/auth/sign-out-navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { fetchWithAuthDeadline } from "@/lib/supabase/session-refresh";

export async function POST(request: Request) {
  if (
    !signOutRequestAllowed(request.headers.get("host"), {
      origin: request.headers.get("origin"),
      site: request.headers.get("sec-fetch-site")
    })
  ) {
    return new NextResponse("Sign out must come from this site", { status: 403 });
  }

  const redirect = NextResponse.redirect(signOutRedirectUrl(request.url), 303);
  if (!isSupabaseConfigured()) return redirect;

  let error: unknown = null;
  try {
    const supabase = await createClient({ fetch: fetchWithAuthDeadline });
    ({ error } = await supabase.auth.signOut({ scope: "local" }));
  } catch (caught) {
    error = caught;
  }

  // auth-js 2.118 still posts /logout for scope "local". A session-load failure
  // returns before _removeSession(), so a failed revoke expires the cookies here.
  // Match @supabase/ssr: Path=/, SameSite=Lax, not HttpOnly, and no Secure flag.
  if (error) {
    for (const name of authCookiesToClear(request.headers.get("cookie"))) {
      redirect.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax", httpOnly: false });
    }
  }

  return redirect;
}
