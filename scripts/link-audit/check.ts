import { getProviderProbe } from "./providers";

export type Outcome = "reachable" | "dead" | "blocked" | "auth" | "rate-limited" | "transient" | "unverified";
export type Observation = { url: string; status?: number; finalUrl?: string; outcome: Outcome; reason: string };

export function isCanonicalRedirect(requested: string, final: string): boolean {
  const normalize = (value: string) => {
    const url = new URL(value);
    url.hash = "";
    if (url.protocol === "http:") url.protocol = "https:";
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ["trk", "gh_src"].includes(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  };
  if (normalize(requested) === normalize(final)) return true;
  const before = getProviderProbe(requested);
  const after = getProviderProbe(final);
  return Boolean(before && after && before.url === after.url);
}

export function classify(status: number, body: string, finalUrl: string, requestedUrl = finalUrl): Pick<Observation, "outcome" | "reason"> {
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  if ([403, 999].includes(status) || /just a moment|access denied|security check|verify you are human|attention required|robot or human/i.test(title)) {
    return { outcome: "blocked", reason: "Access/bot protection; destination validity unknown" };
  }
  if (status === 429) return { outcome: "rate-limited", reason: "Rate limited; not a dead link" };
  if (status === 401 || /\/(?:login|signin|authwall)(?:[/?]|$)/i.test(new URL(finalUrl).pathname)) {
    return { outcome: "auth", reason: "Authentication required" };
  }
  if (status >= 500 || status === 408) return { outcome: "transient", reason: "Server/timeout failure" };
  if (status === 404 || status === 410) return { outcome: "dead", reason: `HTTP ${status}; requires repeat confirmation` };
  if (status >= 200 && status < 300 && !isCanonicalRedirect(requestedUrl, finalUrl)) {
    return { outcome: "unverified", reason: "Redirected to a different resource; posting availability unverified" };
  }
  if (status >= 200 && status < 300) return { outcome: "reachable", reason: "HTTP success; does not prove vacancy remains open" };
  return { outcome: "unverified", reason: `Unexpected HTTP ${status}` };
}

export async function request(url: string): Promise<{ observation: Observation; body: string }> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "EndpointJobs-LinkAudit/1.0", Accept: "text/html,application/json,application/xml;q=0.9,*/*;q=0.8" }
    });
    // Bound memory even for unexpectedly large destination documents.
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let body = "";
    let bytes = 0;
    if (reader) {
      try {
        while (bytes < 8_000_000) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          body += decoder.decode(chunk.value, { stream: true });
        }
      } finally { await reader.cancel(); }
    }
    return { body, observation: { url, status: response.status, finalUrl: response.url, ...(bytes >= 8_000_000 ? { outcome: "unverified" as const, reason: "Response exceeded 8 MB audit limit; coverage incomplete" } : classify(response.status, body, response.url, url)) } };
  } catch (error) {
    return { body: "", observation: { url, outcome: "transient", reason: error instanceof Error ? error.message : String(error) } };
  }
}

export async function mapBounded<T, R>(items: readonly T[], concurrency: number, work: (item: T) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer");
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

export function normalizeLink(href: string, base: string): string | undefined {
  try {
    const url = new URL(href.replaceAll("&amp;", "&"), base);
    if (!["https:", "http:"].includes(url.protocol)) return;
    url.hash = "";
    return url.href;
  } catch { return; }
}

export function extractLinks(html: string, base: string): string[] {
  return [...new Set([...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => normalizeLink(match[1], base)).filter((url): url is string => Boolean(url)))];
}
