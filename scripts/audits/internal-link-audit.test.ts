import assert from "node:assert/strict";
import test from "node:test";
import { auditInternal } from "../link-audit/internal";

const origin = "https://crawl.example";
const sitemap = (...paths: string[]) => `<urlset>${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;

test("internal crawl accepts a singleton sitemap and discovers distinct query destinations once", async (context) => {
  const calls: string[] = [];
  const pages: Record<string, string> = {
    "/sitemap.xml": sitemap("/jobs"),
    "/": '<a href="/jobs#top">Jobs</a><a href="https://other.example/about">About</a>',
    "/api-docs": '<a href="/jobs?page=2&amp;sort=date#top">More</a>',
    "/jobs": '<a href="/jobs?page=2&amp;sort=date">More</a><a href="/jobs?page=3">Last</a>',
    "/jobs?page=2&sort=date": '<a href="/jobs?page=3#top">Last</a>',
    "/jobs?page=3": '<a href="/jobs">First</a>',
  };
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const path = url.pathname + url.search;
    calls.push(path);
    assert.ok(Object.hasOwn(pages, path), `Unexpected request ${url}`);
    const response = new Response(pages[path]);
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  });
  const report = await auditInternal(origin);
  assert.equal(report.sitemapUrls, 1);
  assert.equal(report.results.length, 5);
  assert.equal(calls.length, new Set(calls).size);
  assert.deepEqual(report.results.map((result) => result.url), ["/", "/api-docs", "/jobs", "/jobs?page=2&sort=date", "/jobs?page=3"].map((path) => origin + path));
  assert.ok(report.results.every((result) => result.outcome === "reachable" && result.observations.length === 1));
  assert.deepEqual(report.externalNavigation, ["https://other.example/about"]);
});

test("internal crawl preserves retry failures and still discovers links from recovered pages", async (context) => {
  const counts = new Map<string, number>();
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const attempt = (counts.get(path) ?? 0) + 1;
    counts.set(path, attempt);
    const status = path === "/missing" ? 404 : path === "/flaky" && attempt === 1 ? 503 : 200;
    const body = path === "/sitemap.xml" ? sitemap("/missing", "/flaky") : path === "/flaky" && attempt === 2 ? '<a href="/discovered">Link</a>' : "";
    const response = new Response(body, { status });
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  });
  const report = await auditInternal(origin);
  const missing = report.results.find((result) => result.url.endsWith("/missing"))!;
  assert.equal(missing.outcome, "dead");
  assert.deepEqual(missing.observations.map((attempt) => attempt.status), [404, 404]);
  const flaky = report.results.find((result) => result.url.endsWith("/flaky"))!;
  assert.equal(flaky.outcome, "unverified");
  assert.deepEqual(flaky.observations.map((attempt) => attempt.outcome), ["transient", "reachable"]);
  assert.ok(report.results.some((result) => result.url.endsWith("/discovered")));
  assert.equal(counts.get("/missing"), 2);
  assert.equal(counts.get("/flaky"), 2);
});
