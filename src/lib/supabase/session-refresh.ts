const STATIC_ASSET = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|mjs|json|webmanifest|woff2?)$/i;

/** A Supabase session cookie, not the PKCE verifier that sits beside it. */
export function carriesAuthSessionCookie(cookieNames: readonly string[]): boolean {
  return cookieNames.some((name) => name.includes("-auth-token") && !name.includes("code-verifier"));
}

/** Paths that must keep working without a session refresh. */
export function skipsSessionRefresh(pathname: string): boolean {
  if (pathname === "/api/jobs" || pathname.startsWith("/api/jobs/")) return true;
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) return true;
  if (pathname === "/mcp" || pathname.startsWith("/mcp/")) return true;
  if (pathname.startsWith("/_next/static") || pathname.startsWith("/_next/image")) return true;
  if (pathname === "/favicon.ico") return true;
  return STATIC_ASSET.test(pathname);
}
