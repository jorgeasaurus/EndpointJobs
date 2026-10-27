import { boardHomeRedirectKeys } from "@/lib/board-search-params";

/** Old job-board links lived on `/`. Filter and page queries now belong on `/board`. */
export function legacyHomeBoardRedirect(url: URL) {
  if (url.pathname !== "/") return null;

  for (const key of url.searchParams.keys()) {
    if (!boardHomeRedirectKeys.has(key)) continue;
    const next = new URL(url.href);
    next.pathname = "/board";
    return next;
  }

  return null;
}
