const STATIC_ASSET = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|mjs|json|webmanifest|woff2?)$/i;

export const AUTH_LOOKUP_TIMEOUT_MS = 2000;
export const AUTH_TOKEN_TIMEOUT_MS = 8000;

/** The refresh POST can rotate the token. Other auth calls stay on the short deadline. */
export function authFetchTimeoutMs(input: RequestInfo | URL): number {
  const href = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
  try {
    if (new URL(href).pathname.endsWith("/auth/v1/token")) return AUTH_TOKEN_TIMEOUT_MS;
  } catch {
    return AUTH_LOOKUP_TIMEOUT_MS;
  }
  return AUTH_LOOKUP_TIMEOUT_MS;
}

export function authFetchSignal(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeout: (ms: number) => AbortSignal = AbortSignal.timeout
): AbortSignal {
  const deadline = timeout(authFetchTimeoutMs(input));
  return init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
}

export function fetchWithAuthDeadline(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: authFetchSignal(input, init) });
}

/** Paths that must keep working without a session refresh. */
export function skipsSessionRefresh(pathname: string): boolean {
  if (pathname === "/api/jobs" || pathname.startsWith("/api/jobs/")) return true;
  if (pathname === "/api/board" || pathname.startsWith("/api/board/")) return true;
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) return true;
  if (pathname === "/mcp" || pathname.startsWith("/mcp/")) return true;
  if (pathname.startsWith("/_next/static") || pathname.startsWith("/_next/image")) return true;
  if (pathname === "/favicon.ico") return true;
  return STATIC_ASSET.test(pathname);
}
