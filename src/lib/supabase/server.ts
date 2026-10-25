import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseBrowserEnv } from "./env";

export async function createClient() {
  const { url, anonKey } = supabaseBrowserEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
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
