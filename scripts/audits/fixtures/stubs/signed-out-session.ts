import { noAccount, type SignInSession } from "@/lib/auth/session";

/** Stands in for `@/components/auth/sign-in-session`: Supabase configured, nobody signed in. */
export function useSignInSession(): SignInSession {
  return { configured: true, account: noAccount };
}
