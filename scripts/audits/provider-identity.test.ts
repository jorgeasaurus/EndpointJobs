import assert from "node:assert/strict";
import test from "node:test";

import { buildProviderJobId } from "../job-refresh/shared";
import { companyAtsProviders } from "../job-refresh/providers/company-ats";
import { techmapRssProvider } from "../job-refresh/providers/techmap-rss";
import type { ProviderAdapter } from "../job-refresh/provider";

const title = "Intune Endpoint Engineer";
const longPrefix = "same-prefix-".repeat(12);
const identities = [`${longPrefix}first`, `${longPrefix}second`, "abc-123"];
const urls = identities.map((identity) => `https://example.com/jobs/${identity}`);
const providers: readonly ProviderAdapter[] = [techmapRssProvider, ...companyAtsProviders];

const cases = [
  {
    provider: "techmaprss",
    env: { JOB_TECHMAP_RSS_FEEDS: "example|https://example.com/rss" },
    response: () => new Response(`<rss><channel>${identities.map((identity, index) => `<item><title>${title}</title><guid>${identity}</guid><link>${urls[index]}</link></item>`).join("")}</channel></rss>`)
  },
  {
    provider: "activate",
    env: { JOB_ACTIVATE_SITES: "example|https://example.com/search|Intune" },
    response: () => Response.json({ jobsHtml: identities.map((identity, index) => `<li class="job-item" data-record-key="${identity}"><h3>${title}</h3><a href="${urls[index]}" class="view-details-link">View</a></li>`).join("") })
  },
  {
    provider: "jibe",
    env: { JOB_JIBE_SITES: "example|https://example.com/api/jobs|Intune" },
    response: () => Response.json({ jobs: identities.map((identity) => ({ data: { req_id: identity, slug: identity, title } })) })
  }
];

for (const fixture of cases) {
  test(`${fixture.provider} distinguishes long native IDs and preserves short published IDs`, async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = { ...process.env };
    Object.assign(process.env, fixture.env);
    globalThis.fetch = async () => fixture.response();
    try {
      const provider = providers.find((candidate) => candidate.id === fixture.provider)!;
      const jobs = await provider.fetchJobs({ url: provider.defaultUrl, fetchedAt: new Date("2026-07-15T12:00:00.000Z") });
      assert.equal(jobs.length, 3);
      assert.ok(jobs.every(Boolean));
      assert.equal(new Set(jobs.map((job) => job?.id)).size, 3);
      assert.equal(jobs[2]?.id, `${fixture.provider}-example-abc-123`);
    } finally {
      globalThis.fetch = originalFetch;
      process.env = originalEnv;
    }
  });
}

test("Techmap hashes the complete source URL when the RSS item has no native identity", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.JOB_TECHMAP_RSS_FEEDS = "example|https://example.com/rss";
  globalThis.fetch = async () => new Response(`<rss><channel>${urls.slice(0, 2).map((url) => `<item><title>${title}</title><link>${url}</link></item>`).join("")}</channel></rss>`);
  try {
    const jobs = await techmapRssProvider.fetchJobs({ url: techmapRssProvider.defaultUrl, fetchedAt: new Date("2026-07-15T12:00:00.000Z") });
    assert.equal(jobs.length, 2);
    assert.ok(jobs[0]);
    assert.ok(jobs[1]);
    assert.notEqual(jobs[0].id, jobs[1].id);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("provider IDs preserve only unambiguous lossless short identities", () => {
  assert.equal(buildProviderJobId("activate", "example", title, "abc-123", urls[0]), "activate-example-abc-123");
  const identityPairs = [
    ["A-B", "same-id", "A B", "same-id"],
    ["Example", "same-id", "example", "same-id"],
    ["example", "ABC-123", "example", "abc-123"],
    ["example", " abc-123 ", "example", "abc-123"],
    ["a-b", "c", "a", "b-c"],
    [`${"a".repeat(96)}first`, "same-id", `${"a".repeat(96)}second`, "same-id"],
    ["A-B", `${longPrefix}same`, "A B", `${longPrefix}same`]
  ];
  for (const [accountA, nativeA, accountB, nativeB] of identityPairs) {
    assert.notEqual(
      buildProviderJobId("activate", accountA, title, nativeA, urls[0]),
      buildProviderJobId("activate", accountB, title, nativeB, urls[0]),
      `distinct identity tuples: ${JSON.stringify([accountA, nativeA, accountB, nativeB])}`
    );
  }
  assert.notEqual(
    buildProviderJobId("activate", "A-B", title, undefined, urls[0]),
    buildProviderJobId("activate", "A B", title, undefined, urls[0])
  );
});
