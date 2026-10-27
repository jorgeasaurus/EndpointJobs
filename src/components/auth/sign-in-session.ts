import { useSyncExternalStore } from "react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type SignInSession = {
  configured: boolean;
  email: string | null;
  userId?: string | null;
};

export function canShowSignInOffer(session: SignInSession) {
  return session.configured && session.email === null;
}

let session: SignInSession = {
  configured: isSupabaseConfigured(),
  email: null,
  userId: null
};
let started = false;
const listeners = new Set<() => void>();

function publish(next: SignInSession) {
  session = next;
  for (const listener of listeners) listener();
}

function ensureLoaded() {
  if (started || !session.configured) return;
  started = true;
  void createClient()
    .auth.getClaims()
    .then(({ data }) => {
      const claims = data?.claims;
      const userId = typeof claims?.sub === "string" ? claims.sub : null;
      if (!claims || !userId) {
        publish({ configured: true, email: null, userId: null });
        return;
      }
      const claimEmail = claims.email;
      publish({
        configured: true,
        userId,
        email: typeof claimEmail === "string" && claimEmail ? claimEmail : "Signed in"
      });
    })
    .catch(() => {
      publish({ configured: true, email: null, userId: null });
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
