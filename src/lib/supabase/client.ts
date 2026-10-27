import { createBrowserClient } from "@supabase/ssr";

import { supabaseBrowserEnv } from "./env";

export function createClient() {
  const { url, anonKey } = supabaseBrowserEnv();
  return createBrowserClient(url, anonKey);
}
