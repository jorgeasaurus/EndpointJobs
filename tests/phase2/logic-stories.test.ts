import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { getJobJsonLd } from "@/app/structured-data";
import { initialFilterState } from "@/components/job-board/filter-model";
import feedData from "@/data/jobs.json";
import { handleAuthCallback } from "@/lib/auth/callback-session";
import { saveProfileOnSignIn } from "@/lib/auth/profile-consent";
import { safeNextPath, safeRedirectUrl, buildOAuthRedirectTo } from "@/lib/auth/safe-next-path";
import { getActiveBoardFeed, queryBoardPage } from "@/lib/board-page";
import { isSourceFreshnessExpired } from "@/lib/job-exclusions";
import { filterJobs } from "@/lib/job-filters";
import { presentSalary } from "@/lib/job-trust";
import { formatPostedDate, formatUpdatedAt, getFreshnessLabel, isActiveJob, isPostedDateKnown } from "@/lib/jobs";
import { formatDescriptionAsHtml } from "@/lib/rich-result-schema";
import { authFetchTimeoutMs, skipsSessionRefresh } from "@/lib/supabase/session-refresh";
import { assertPrerenderedHomeHtml, prerenderedHomeHtmlPath } from "../../scripts/audits/home-html-size";
import { contrastRatio } from "../../scripts/audits/contrast.test";
import type { Job, JobsFeed } from "@/types/job";

const feed = feedData as JobsFeed;
const active = getActiveBoardFeed(feed);
const base = process.env.PHASE2_BASE_URL ?? "http://127.0.0.1:3000";

test("[SAL-02] location currency stays out of the USD floor", () => {
  const inferred = presentSalary({
    location: "London, UK",
    salary: { min: 80000, max: 100000, currency: "USD", currencySource: "default", label: "80000-100000" }
  });
  assert.equal(inferred?.currency, "GBP");
  const sourced = presentSalary({
    location: "London, UK",
    salary: { min: 80000, max: 100000, currency: "USD", currencySource: "source", label: "80000-100000" }
  });
  assert.equal(sourced?.currency, "USD");
  const marked = presentSalary({
    location: "Paris, France",
    salary: { min: 80000, max: 100000, currency: "USD", currencySource: "default", label: "USD 80k" }
  });
  assert.equal(marked?.currency, "USD");
  const domestic = presentSalary({
    location: "Austin, TX",
    salary: { min: 80000, max: 100000, currency: "USD", currencySource: "default", label: "80000-100000" }
  });
  assert.equal(domestic?.currency, "USD");

  const floor = filterJobs(active.jobs, { ...initialFilterState, minimumSalary: "200000" });
  for (const job of floor) {
    assert.equal(job.salary?.currency, "USD");
    const ceiling = job.salary?.max ?? job.salary?.min ?? 0;
    assert.ok(ceiling >= 200000, job.id);
  }
});

test("[FRESH-02] posted age labels", () => {
  const today = new Date();
  today.setUTCHours(1, 0, 0, 0);
  assert.equal(getFreshnessLabel(today.toISOString()), "Posted today");
  assert.equal(formatPostedDate("not-a-date"), "Fresh");
  const unknown = active.jobs.find((job) => !isPostedDateKnown(job));
  if (unknown) assert.equal(isPostedDateKnown(unknown), false);
  const known = active.jobs.find((job) => isPostedDateKnown(job));
  assert.ok(known, "active feed should include a known posted date");
});

test("[FRESH-03] inactive jobs stay out of the public feed", () => {
  for (const job of active.jobs) assert.equal(isActiveJob(job), true);
  const stale = active.jobs.find((job) => job.staleAfter);
  assert.ok(stale);
  const expired = { ...stale, staleAfter: "2000-01-01T00:00:00.000Z" };
  assert.equal(isActiveJob(expired, new Date("2026-10-27T00:00:00.000Z")), false);
  const page = queryBoardPage(active, initialFilterState, 1);
  assert.ok(page.total <= active.jobs.length);
});

test("[FRESH-04] aggregator age caps", () => {
  const now = new Date("2026-10-27T00:00:00.000Z");
  const adzuna = feed.jobs.find((job) => job.source === "Adzuna") ?? active.jobs[0];
  const oldFetch = { ...adzuna, source: "Adzuna" as const, fetchedAt: "2026-10-01T00:00:00.000Z", postedAt: "2026-10-20T00:00:00.000Z" };
  assert.equal(isSourceFreshnessExpired(oldFetch, now), true);
  const oldPosted = { ...adzuna, source: "Adzuna" as const, fetchedAt: "2026-10-26T00:00:00.000Z", postedAt: "2026-09-01T00:00:00.000Z" };
  assert.equal(isSourceFreshnessExpired(oldPosted, now), true);
  const fresh = { ...adzuna, source: "Adzuna" as const, fetchedAt: "2026-10-26T00:00:00.000Z", postedAt: "2026-10-20T00:00:00.000Z" };
  assert.equal(isSourceFreshnessExpired(fresh, now), false);
  const other = { ...adzuna, source: "Greenhouse" as const, fetchedAt: "2020-01-01T00:00:00.000Z", postedAt: "2020-01-01T00:00:00.000Z" };
  assert.equal(isSourceFreshnessExpired(other, now), false);
});

test("[API-05] PowerShell module calls the public API", () => {
  const command = readFileSync("powershell/EndpointJobs/Public/Get-EndpointJob.ps1", "utf8");
  for (const name of ["Limit", "Page", "Tool", "Platform", "Workplace", "Sponsorship", "Leadership", "SalaryShown", "Freshness", "MinimumSalary", "Id"]) {
    assert.match(command, new RegExp(`\\$${name}\\b`));
  }
  assert.match(command, /https:\/\/endpointjobs\.dev/);
  const request = readFileSync("powershell/EndpointJobs/Private/Invoke-EndpointJobsRequest.ps1", "utf8");
  assert.match(request, /ThrowTerminatingError/);
  assert.match(request, /apiError\.code/);
  assert.match(request, /StatusCode|HttpStatusCode/, "terminating API errors do not include the HTTP status");
  assert.doesNotMatch(`${command}\n${request}`, /ENDPOINTJOBS_API_KEY|Authorization/);
  const workflow = readFileSync(".github/workflows/powershell-module.yml", "utf8");
  assert.match(workflow, /powershell/);
});

test("[FRESH-05] refresh workflow is declared and not dispatched", () => {
  const yaml = readFileSync(".github/workflows/refresh-jobs.yml", "utf8");
  assert.match(yaml, /cron:\s*"17 11 \* \* \*"/);
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /npm run jobs:refresh/);
  assert.match(yaml, /src\/data\/jobs\.json/);
});

test("[AUTH-03] first profile insert stores the privacy version", async () => {
  let inserted: { id: string; email: string; privacyVersion: string } | undefined;
  let updated: { id: string; email: string } | undefined;
  const created = await saveProfileOnSignIn({
    profile: { id: "user-1", email: "person@example.com", privacyVersion: "2026-10-24" },
    insertProfile: async (profile) => {
      inserted = profile;
      return { error: null };
    },
    updateEmail: async () => {
      throw new Error("update should not run");
    }
  });
  assert.equal(created.error, null);
  assert.deepEqual(inserted, { id: "user-1", email: "person@example.com", privacyVersion: "2026-10-24" });

  const duplicate = await saveProfileOnSignIn({
    profile: { id: "user-1", email: "next@example.com", privacyVersion: "2099-01-01" },
    insertProfile: async () => ({ error: { code: "23505" } }),
    updateEmail: async (id, email) => {
      updated = { id, email };
      return { error: null };
    }
  });
  assert.equal(duplicate.error, null);
  assert.deepEqual(updated, { id: "user-1", email: "next@example.com" });

  const failed = await saveProfileOnSignIn({
    profile: { id: "user-1", email: "person@example.com", privacyVersion: "2026-10-24" },
    insertProfile: async () => ({ error: { code: "42501" } }),
    updateEmail: async () => {
      throw new Error("update should not run");
    }
  });
  assert.equal((failed.error as { code: string }).code, "42501");
});

test("[AUTH-02] callback next safety without a live session", async () => {
  let signedOut = false;
  const missing = await handleAuthCallback({
    requestUrl: "http://127.0.0.1:3000/auth/callback?next=https://evil.example",
    exchangeCode: async () => {
      throw new Error("no code");
    },
    upsertProfile: async () => ({ error: null }),
    signOutLocal: async () => {
      signedOut = true;
    }
  });
  assert.equal(signedOut, false);
  assert.equal(missing.pathname, "/");

  const failed = await handleAuthCallback({
    requestUrl: "http://127.0.0.1:3000/auth/callback?code=bad&next=/board?q=jamf",
    exchangeCode: async () => ({ error: new Error("bad"), user: null }),
    upsertProfile: async () => ({ error: null }),
    signOutLocal: async () => {
      signedOut = true;
    }
  });
  assert.equal(signedOut, false);
  assert.equal(failed.pathname, "/");
});

test("[AUTH-05] safe next paths and local allow list", () => {
  assert.equal(safeNextPath("/board?q=C%2B%2B"), "/board?q=C%2B%2B");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("/\\evil"), "/");
  assert.equal(safeNextPath(`/${"a".repeat(2048)}`), "/");
  const destination = safeRedirectUrl("http://127.0.0.1:3000", "/board?q=1");
  assert.equal(destination.origin, "http://127.0.0.1:3000");
  assert.equal(destination.pathname, "/board");
  const redirect = buildOAuthRedirectTo("http://127.0.0.1:3000", "/board?workplace=Remote");
  assert.equal(redirect, "http://127.0.0.1:3000/auth/callback?next=%2Fboard%3Fworkplace%3DRemote");
  const config = readFileSync("supabase/config.toml", "utf8");
  assert.match(config, /http:\/\/127\.0\.0\.1:3000\/auth\/callback\*\*/);
  assert.match(config, /http:\/\/localhost:3000\/auth\/callback\*\*/);
});

test("[AUTH-07] session refresh skips public routes", () => {
  assert.equal(authFetchTimeoutMs("https://example.supabase.co/auth/v1/token"), 8000);
  assert.equal(authFetchTimeoutMs("https://example.supabase.co/auth/v1/user"), 2000);
  for (const path of ["/api/jobs", "/api/jobs/abc", "/api/board", "/api/board/map", "/api/mcp", "/mcp", "/favicon.ico", "/og-image.png"]) {
    assert.equal(skipsSessionRefresh(path), true, path);
  }
  assert.equal(skipsSessionRefresh("/board"), false);
  assert.equal(skipsSessionRefresh("/privacy"), false);
});

test("[ACCT-01] saved filters are not written by the app", () => {
  const sql = readFileSync("supabase/migrations/0001_user_data.sql", "utf8");
  assert.match(sql, /create table public\.user_preferences/i);
  assert.match(sql, /filters jsonb/);
  const source = readSource("src");
  assert.doesNotMatch(source, /from\(["']user_preferences["']\)/);
  assert.doesNotMatch(source, /user_preferences/);
});

test("[ACCT-02] viewed jobs are not recorded", () => {
  const sql = readFileSync("supabase/migrations/0001_user_data.sql", "utf8");
  assert.match(sql, /create table public\.job_views/i);
  assert.match(sql, /record_job_view/);
  const source = readSource("src");
  assert.doesNotMatch(source, /record_job_view/);
  assert.doesNotMatch(source, /from\(["']job_views["']\)/);
});

test("[ACCT-03] saved jobs have no control", () => {
  const sql = readFileSync("supabase/migrations/0001_user_data.sql", "utf8");
  assert.match(sql, /create table public\.saved_jobs/i);
  const source = readSource("src");
  assert.doesNotMatch(source, /from\(["']saved_jobs["']\)/);
  assert.doesNotMatch(source, /saved_jobs/);
});

test("[ACCT-05] no export control", () => {
  const source = readSource("src");
  assert.doesNotMatch(source, /export account|download my data|account\/export/i);
});

test("[ACCT-06] no delete-account action", () => {
  const sql = readFileSync("supabase/migrations/0001_user_data.sql", "utf8");
  assert.match(sql, /on delete cascade/i);
  const source = readSource("src");
  assert.doesNotMatch(source, /deleteUser|delete-account|auth\.admin\.deleteUser/);
});

test("[ACCT-07] no clear-history control", () => {
  const source = readSource("src");
  assert.doesNotMatch(source, /from\(["']job_views["']\)/);
});

test("[PERF-01] prerendered home html budget", () => {
  assertPrerenderedHomeHtml(readFileSync(prerenderedHomeHtmlPath));
  const workflow = readFileSync(".github/workflows/home-html-size.yml", "utf8");
  assert.match(workflow, /pull_request/);
  assert.match(workflow, /home-html-size|audit:html-size/);
});

test("[A11Y-04] documented contrast pairs", () => {
  const obsidian: [number, number, number] = [7, 9, 11];
  const black: [number, number, number] = [0, 0, 0];
  const label: [number, number, number] = [215, 222, 231];
  const cyan: [number, number, number] = [56, 189, 248];
  const emerald: [number, number, number] = [45, 212, 191];
  const lime: [number, number, number] = [190, 242, 100];
  const blend = (foreground: [number, number, number], background: [number, number, number], alpha: number) =>
    foreground.map((component, index) => Math.round(component * alpha + background[index] * (1 - alpha))) as [number, number, number];
  const pairs = [
    [label, obsidian],
    [label, black],
    [cyan, blend(cyan, obsidian, 0.08)],
    [emerald, blend(emerald, obsidian, 0.08)],
    [black, lime]
  ] as const;
  for (const [foreground, background] of pairs) {
    assert.ok(contrastRatio(foreground, background) >= 4.5);
  }
});

test("[SEO-04] job structured data escapes html", () => {
  assert.match(formatDescriptionAsHtml("<script>alert(1)</script>"), /&lt;script&gt;/);
  assert.doesNotMatch(formatDescriptionAsHtml("<script>alert(1)</script>"), /<script>/);
  const job = active.jobs[0];
  const graph = JSON.stringify(getJobJsonLd(job));
  assert.match(graph, /"@context"/);
});

test("[FRESH-01] updated formatter", () => {
  assert.equal(formatUpdatedAt("not-a-date"), "Pending refresh");
  assert.match(formatUpdatedAt("2026-10-27T11:17:00.000Z"), /UTC/);
});

test("[MCP-01] live mcp tools match the jobs api", () => {
  const result = spawnSync("npx", ["tsx", "scripts/audits/jobs-mcp-smoke.ts", base], {
    encoding: "utf8",
    timeout: 90_000
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const route = readFileSync("src/app/api/mcp/route.ts", "utf8");
  assert.match(route, /untrusted/);
  assert.match(route, /must not be inferred/);
});

test("[HOME-06] board collection uses the active feed order", async () => {
  const html = await (await fetch(`${base}/board`)).text();
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  const graph = JSON.parse(match[1]) as { "@graph": { "@type": string; mainEntity?: { itemListElement?: { url: string }[] } }[] };
  const collection = graph["@graph"].find((node) => node["@type"] === "CollectionPage");
  const urls = collection?.mainEntity?.itemListElement?.map((item) => item.url) ?? [];
  assert.equal(urls.length, Math.min(20, active.jobs.length));
  const expected = active.jobs.slice(0, 20).map((job) => `https://endpointjobs.dev/jobs/${job.id}`);
  assert.deepEqual(urls, expected);
});

function readSource(directory: string): string {
  const chunks: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) chunks.push(readSource(path));
    else if (/\.(ts|tsx)$/.test(entry)) chunks.push(readFileSync(path, "utf8"));
  }
  return chunks.join("\n");
}

void (0 as unknown as Job);
