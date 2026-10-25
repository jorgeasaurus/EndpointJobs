import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured, supabaseBrowserEnv } from "./env";
import { skipsSessionRefresh } from "./session-refresh";

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured() || skipsSessionRefresh(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  try {
    const { url, anonKey } = supabaseBrowserEnv();
    const supabase = createServerClient(url, anonKey, {
      global: {
        fetch: (input, init) => {
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
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}
