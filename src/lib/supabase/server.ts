import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseBrowserEnv } from "./env";

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function createClient(options?: { fetch?: AuthFetch }) {
  const { url, anonKey } = supabaseBrowserEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    ...(options?.fetch ? { global: { fetch: options.fetch } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the session.
        }
      }
    }
  });
}
