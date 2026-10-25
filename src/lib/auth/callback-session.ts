import { PRIVACY_POLICY_VERSION } from "@/app/privacy/version";
import { safeNextPath, safeRedirectUrl } from "@/lib/auth/safe-next-path";

export type CallbackCleanup = "none" | "local";

type CallbackUser = {
  id: string;
  email?: string | null;
  identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
};

export type CallbackResult = {
  redirectTo: URL;
  cleanup: CallbackCleanup;
};

/**
 * A failed code exchange must not sign out: the browser may already have a
 * session, and signOut() defaults to global scope. Local cleanup is only for
 * a session this callback just established and then could not finish.
 */
export function callbackSessionCleanup(state: {
  exchangeSucceeded: boolean;
  profileFailed: boolean;
}): CallbackCleanup {
  if (!state.exchangeSucceeded) return "none";
  if (state.profileFailed) return "local";
  return "none";
}

function emailFromUser(user: CallbackUser): string | null {
  if (typeof user.email === "string" && user.email.trim()) return user.email.trim();
  for (const identity of user.identities ?? []) {
    const value = identity.identity_data?.email;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function handleAuthCallback(input: {
  requestUrl: string;
  exchangeCode: (code: string) => Promise<{ error: unknown; user: CallbackUser | null }>;
  upsertProfile: (profile: { id: string; email: string; privacyVersion: string }) => Promise<{ error: unknown }>;
  signOutLocal: () => Promise<unknown>;
}): Promise<CallbackResult> {
  const url = new URL(input.requestUrl);
  const home = new URL("/", url.origin);
  const code = url.searchParams.get("code");
  if (!code) return { redirectTo: home, cleanup: "none" };

  const exchanged = await input.exchangeCode(code);
  if (exchanged.error || !exchanged.user) {
    return {
      redirectTo: home,
      cleanup: callbackSessionCleanup({ exchangeSucceeded: false, profileFailed: false })
    };
  }

  const email = emailFromUser(exchanged.user);
  let profileFailed = !email;
  if (email) {
    const profile = await input.upsertProfile({
      id: exchanged.user.id,
      email,
      privacyVersion: PRIVACY_POLICY_VERSION
    });
    profileFailed = Boolean(profile.error);
  }

  const cleanup = callbackSessionCleanup({ exchangeSucceeded: true, profileFailed });
  if (cleanup === "local") {
    await input.signOutLocal();
    return { redirectTo: home, cleanup };
  }

  const searchParams = url.searchParams;
  return {
    redirectTo: safeRedirectUrl(url.origin, safeNextPath(searchParams.get("next"))),
    cleanup
  };
}
