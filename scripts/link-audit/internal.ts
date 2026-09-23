import { XMLParser } from "fast-xml-parser";
import { extractLinks, mapBounded, request, type Observation } from "./check";

export async function auditInternal(base: string) {
  const origin = new URL(base).origin;
  const sitemap = await request(`${origin}/sitemap.xml`);
  if (sitemap.observation.outcome !== "reachable") throw new Error("Cannot load sitemap");
  const parsed = new XMLParser().parse(sitemap.body);
  const entries = parsed.urlset?.url;
  if (!Array.isArray(entries) || !entries.length) throw new Error("Expected nonempty sitemap urlset");
  const seeds = entries.map((entry: { loc: string }) => entry.loc);
  if (seeds.some((url: string) => new URL(url).origin !== origin)) throw new Error("Sitemap contains another origin");
  const seen = new Set<string>();
  const externalNavigation = new Set<string>();
  const results: Observation[] = [];
  let queue: string[] = [...new Set([`${origin}/`, `${origin}/api-docs`, ...seeds])];
  while (queue.length) {
    if (seen.size + queue.length > 10_000) throw new Error("Internal crawl exceeded 10,000 URLs");
    queue.forEach((url) => seen.add(url));
    const discovered: string[] = [];
    await mapBounded(queue, 6, async (url) => {
      let result = await request(url);
      if (["dead", "transient"].includes(result.observation.outcome)) result = await request(url);
      if (result.observation.outcome === "reachable" && /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(result.body)) {
        result.observation = { ...result.observation, outcome: "unverified", reason: "HTTP success with noindex; inspect for streamed not-found" };
      }
      results.push(result.observation);
      for (const link of extractLinks(result.body, result.observation.finalUrl ?? url)) {
        if (new URL(link).origin === origin) { if (!seen.has(link)) discovered.push(link); }
        else externalNavigation.add(link);
      }
    });
    queue = [...new Set(discovered)];
    console.log(`Internal: ${results.length} checked, ${queue.length} newly discovered`);
  }
  return { sitemapUrls: seeds.length, results: results.sort((a, b) => a.url.localeCompare(b.url)), externalNavigation: [...externalNavigation].sort() };
}
