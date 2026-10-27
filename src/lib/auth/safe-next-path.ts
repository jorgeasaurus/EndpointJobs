const REDIRECT_BASE = "http://127.0.0.1";
const MAX_NEXT_LENGTH = 2048;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F\u2028\u2029]/;

/**
 * Accept only a same-origin relative path. Anything else, including
 * protocol-relative URLs, backslashes, schemes, and encoded forms of those,
 * becomes "/".
 *
 * The returned value is the original escaped path and query. A decoded copy
 * is used only to reject open redirects, so filters such as C%2B%2B, R%26D,
 * and 100%25 are not rewritten.
 */
export function safeNextPath(input: string | null | undefined): string {
  if (typeof input !== "string") return "/";
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NEXT_LENGTH) return "/";

  const decoded = decodedForValidation(trimmed);
  if (decoded === null) return "/";
  if (!isSafeRelative(decoded) || !isSafeRelative(trimmed)) return "/";
  return trimmed;
}

export function safeRedirectUrl(origin: string, next: string | null | undefined): URL {
  const base = new URL(origin);
  const destination = new URL(safeNextPath(next), base);
  if (destination.origin !== base.origin) return new URL("/", base);
  return destination;
}

export function buildOAuthRedirectTo(origin: string, pathAndQuery: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeNextPath(pathAndQuery));
  return url.toString();
}

function decodedForValidation(value: string): string | null {
  let decoded = value;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return attempt === 0 ? null : decoded;
    }
    if (next === decoded) return decoded;
    decoded = next;
    if (attempt === 4) return null;
  }
  return decoded;
}

function isSafeRelative(value: string): boolean {
  const normalized = value.normalize("NFKC");
  if (!normalized.startsWith("/") || normalized.startsWith("//") || normalized.startsWith("/\\")) return false;
  if (normalized.includes("\\") || CONTROL_CHARACTERS.test(normalized)) return false;

  let parsed: URL;
  try {
    parsed = new URL(normalized, REDIRECT_BASE);
  } catch {
    return false;
  }
  if (parsed.origin !== REDIRECT_BASE) return false;

  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;

  let confirmed: URL;
  try {
    confirmed = new URL(path, REDIRECT_BASE);
  } catch {
    return false;
  }
  if (confirmed.origin !== REDIRECT_BASE) return false;
  const again = `${confirmed.pathname}${confirmed.search}${confirmed.hash}`;
  return again.startsWith("/") && !again.startsWith("//");
}
