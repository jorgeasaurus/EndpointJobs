export const SIGN_OUT_PATH = "/auth/sign-out";

export function signOutRedirectUrl(requestUrl: string): URL {
  return new URL("/", new URL(requestUrl).origin);
}

/** Cross-site posts must not clear a session. A missing Origin is allowed for non-browser clients. */
export function signOutRequestAllowed(
  host: string | null,
  headers: { origin: string | null; site: string | null }
): boolean {
  if (headers.site === "cross-site") return false;
  if (!headers.origin) return true;
  try {
    return host !== null && new URL(headers.origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Local sign-out clears this browser even when the server revoke returns an
 * error. Stay on an error response only when that session is still present.
 */
export function signOutRedirectDecision(input: { error: unknown; stillSignedIn: boolean }): "home" | "unavailable" {
  if (input.error && input.stillSignedIn) return "unavailable";
  return "home";
}
