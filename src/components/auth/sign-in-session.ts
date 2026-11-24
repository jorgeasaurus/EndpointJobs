import { useSyncExternalStore } from "react";

import { devAuthFixture } from "@/lib/auth/dev-auth-fixture";
import { noAccount, type SignInSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

let session: SignInSession = {
  configured: isSupabaseConfigured(),
  account: noAccount
};
let started = false;
const listeners = new Set<() => void>();

function publish(next: SignInSession) {
  session = next;
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  if (started) return;
  if (typeof window !== "undefined") {
    const fixture = devAuthFixture(window.location.search, process.env.NODE_ENV !== "production");
    if (fixture) {
      started = true;
      publish(fixture);
      return;
    }
  }
  if (!session.configured) return;
  started = true;
  void createClient()
    .auth.getClaims()
    .then(({ data }) => {
      const claims = data?.claims;
      const userId = typeof claims?.sub === "string" ? claims.sub : null;
      if (!claims || !userId) {
        publish({ configured: true, account: noAccount });
        return;
      }
      const claimEmail = claims.email;
      const email = typeof claimEmail === "string" && claimEmail ? claimEmail : "Signed in";
      publish({ configured: true, account: { kind: "account", userId, email } });
    })
    .catch(() => {
      publish({ configured: true, account: noAccount });
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureLoaded();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return session;
}

export function useSignInSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
