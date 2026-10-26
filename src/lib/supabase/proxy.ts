import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseBrowserEnv } from "./env";
import { fetchWithAuthDeadline, skipsSessionRefresh } from "./session-refresh";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured() || skipsSessionRefresh(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const { url, anonKey } = supabaseBrowserEnv();
    const supabase = createServerClient(url, anonKey, {
      global: {
        // /auth/v1/token gets 8s so a refresh can finish and setAll can store
        // the rotated cookies. Every other call, including getUser, stays at 2s.
        fetch: fetchWithAuthDeadline
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
    // A lookup can abort after the refresh already wrote cookies here.
    return supabaseResponse;
  }

  return supabaseResponse;
}
