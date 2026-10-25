const REDIRECT_BASE = "http://127.0.0.1";
const MAX_NEXT_LENGTH = 2048;

/**
 * Accept only a same-origin relative path. Anything else, including
 * protocol-relative URLs, backslashes, schemes, and encoded forms of those,
 * becomes "/".
 */
export function safeNextPath(input: string | null | undefined): string {
  if (typeof input !== "string") return "/";
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NEXT_LENGTH) return "/";

  let decoded = trimmed;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return "/";
    }
    if (next === decoded) break;
    decoded = next;
    if (attempt === 4) return "/";
  }

  const value = decoded.normalize("NFKC");
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("\\") || /[\u0000-\u001F\u007F\u2028\u2029]/.test(value)) return "/";

  let parsed: URL;
  try {
    parsed = new URL(value, REDIRECT_BASE);
  } catch {
    return "/";
  }
  if (parsed.origin !== REDIRECT_BASE) return "/";

  const rebuilt = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!rebuilt.startsWith("/") || rebuilt.startsWith("//") || rebuilt.includes("\\")) return "/";

  let confirmed: URL;
  try {
    confirmed = new URL(rebuilt, REDIRECT_BASE);
  } catch {
    return "/";
  }
  if (confirmed.origin !== REDIRECT_BASE) return "/";
  const path = `${confirmed.pathname}${confirmed.search}${confirmed.hash}`;
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
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
