import { PRIVACY_POLICY_VERSION } from "@/app/privacy/version";
import { safeNextPath, safeRedirectUrl } from "@/lib/auth/safe-next-path";

type CallbackUser = {
  id: string;
  email?: string | null;
  identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
};

/**
 * A failed code exchange returns home and does not sign out. signOut() defaults
 * to global scope, so it would revoke a session the browser already had.
 * Local sign-out is only for a session this callback just established and then
 * could not finish (no email, or the profile upsert failed).
 */
export async function handleAuthCallback(input: {
  requestUrl: string;
  exchangeCode: (code: string) => Promise<{ error: unknown; user: CallbackUser | null }>;
  upsertProfile: (profile: { id: string; email: string; privacyVersion: string }) => Promise<{ error: unknown }>;
  signOutLocal: () => Promise<unknown>;
}): Promise<URL> {
  const url = new URL(input.requestUrl);
  const home = new URL("/", url.origin);
  const code = url.searchParams.get("code");
  if (!code) return home;

  const exchanged = await input.exchangeCode(code);
  if (exchanged.error || !exchanged.user) return home;

  const email = emailFromUser(exchanged.user);
  const saved = email
    ? await input.upsertProfile({
        id: exchanged.user.id,
        email,
        privacyVersion: PRIVACY_POLICY_VERSION
      })
    : null;
  if (!saved || saved.error) {
    await input.signOutLocal();
    return home;
  }

  const searchParams = url.searchParams;
  return safeRedirectUrl(url.origin, safeNextPath(searchParams.get("next")));
}

function emailFromUser(user: CallbackUser): string | null {
  if (typeof user.email === "string" && user.email.trim()) return user.email.trim();
  for (const identity of user.identities ?? []) {
    const value = identity.identity_data?.email;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
