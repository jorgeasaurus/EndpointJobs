import type { SignInSession } from "@/components/auth/sign-in-session";

/** Stands in for `@/components/auth/sign-in-session`: Supabase configured, nobody signed in. */
export function canShowSignInOffer(session: SignInSession) {
  return session.configured && session.email === null;
}

export function useSignInSession(): SignInSession {
  return { configured: true, email: null };
}
