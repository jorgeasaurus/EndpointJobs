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

const AUTH_COOKIE_NAME = /^sb-[A-Za-z0-9._-]*-auth-token[A-Za-z0-9._-]*$/;

/** sb-*-auth-token* names from a Cookie header, including chunked .0/.1 cookies. */
export function authCookiesToClear(cookieHeader: string | null): string[] {
  if (!cookieHeader) return [];
  const names = new Set<string>();
  for (const part of cookieHeader.split(";")) {
    const name = part.split("=", 1)[0]?.trim() ?? "";
    // Trim only surrounding whitespace. A CR, LF, or other character inside the
    // name fails the pattern so it cannot be copied into Set-Cookie.
    if (AUTH_COOKIE_NAME.test(name)) names.add(name);
  }
  return [...names];
}
