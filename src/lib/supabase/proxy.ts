import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseBrowserEnv } from "./env";
import { carriesAuthSessionCookie, skipsSessionRefresh } from "./session-refresh";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured() || skipsSessionRefresh(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  // getClaims() refreshes inside the expiry margin and rotates the refresh
  // token before setAll stores it. Aborting that POST, or a later lookup,
  // must not throw away cookies already written onto supabaseResponse.
  const preserveSessionRefresh = carriesAuthSessionCookie(
    request.cookies.getAll().map((cookie) => cookie.name)
  );

  try {
    const { url, anonKey } = supabaseBrowserEnv();
    const supabase = createServerClient(url, anonKey, {
      global: {
        fetch: (input, init) => {
          if (preserveSessionRefresh) return fetch(input, init);
          const timeout = AbortSignal.timeout(2000);
          const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
          return fetch(input, { ...init, signal });
        }
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        }
      }
    });

    // Refresh immediately. Nothing else may run between creating the client and getClaims().
    await supabase.auth.getClaims();
  } catch {
    return supabaseResponse;
  }

  return supabaseResponse;
}
