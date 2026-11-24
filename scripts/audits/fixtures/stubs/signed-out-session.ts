import { noAccount, type SignInSession } from "@/lib/auth/session";

/** Stands in for `@/components/auth/sign-in-session`: Supabase configured, nobody signed in. */
export function canShowSignInOffer(session: Pick<SignInSession, "configured" | "email">) {
  return session.configured && session.email === null;
}

export function useSignInSession(): SignInSession {
  return { configured: true, email: null, account: noAccount };
}
