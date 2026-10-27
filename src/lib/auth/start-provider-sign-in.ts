import { buildOAuthRedirectTo } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/client";

export type OAuthProvider = "google" | "github";

export const signInStartError = "Sign-in could not start. Try again in a moment.";

type OAuthStart = (input: {
  provider: OAuthProvider;
  redirectTo: string;
}) => Promise<{ error: { message: string } | null }>;

export async function startProviderSignIn(
  provider: OAuthProvider,
  deps?: {
    origin?: string;
    pathAndQuery?: string;
    start?: OAuthStart;
  }
): Promise<string | null> {
  const origin = deps?.origin ?? window.location.origin;
  const pathAndQuery = deps?.pathAndQuery ?? `${window.location.pathname}${window.location.search}`;
  const redirectTo = buildOAuthRedirectTo(origin, pathAndQuery);
  try {
    const { error } = await (deps?.start ?? defaultStart)({ provider, redirectTo });
    return error ? signInStartError : null;
  } catch {
    return signInStartError;
  }
}

async function defaultStart(input: { provider: OAuthProvider; redirectTo: string }) {
  const { error } = await createClient().auth.signInWithOAuth({
    provider: input.provider,
    options: { redirectTo: input.redirectTo }
  });
  return { error };
}
