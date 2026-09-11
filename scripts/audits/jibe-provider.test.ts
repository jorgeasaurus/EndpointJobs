import assert from "node:assert/strict";
import test from "node:test";

import { companyAtsProviders } from "../job-refresh/providers/company-ats";

const jibeProvider = companyAtsProviders.find((provider) => provider.id === "jibe");
const fetchedAt = new Date("2026-07-15T12:00:00.000Z");

function listing(title: string, description = "") {
  return {
    data: {
      req_id: "R100",
      slug: "example-role",
      title,
      description
    }
  };
}

async function fetchJibeJobs(query: string, job = listing("IT Engineer", "Support corporate systems and internal business applications.")) {
  assert.ok(jibeProvider);
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.JOB_JIBE_SITES = `Example|https://example.com/api/jobs|${query}`;
  globalThis.fetch = async () => Response.json({ jobs: [job] });

  try {
    return await jibeProvider.fetchJobs({ url: jibeProvider.defaultUrl, fetchedAt });
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
}

test("Jibe search queries keep endpoint-relevant listings without publishing the query", async () => {
  const [admitted] = await fetchJibeJobs("Intune");
  assert.ok(admitted);
  assert.equal(admitted.title, "IT Engineer");
  assert.deepEqual(admitted.tools, []);
  const [otherQuery] = await fetchJibeJobs("Jamf Android senior contract remote security");
  assert.deepEqual(otherQuery, admitted, "Search evidence must not change any published field");
  assert.doesNotMatch(`${admitted.summary}\n${admitted.description ?? ""}`, /Intune/i);

  const rejected = await fetchJibeJobs("Payroll");
  assert.deepEqual(rejected, [null]);
});

test("Jibe still publishes genuine listing evidence", async () => {
  const [job] = await fetchJibeJobs(
    "Kandji",
    listing(
      "Windows Endpoint Engineer",
      "Manage Windows devices and Intune deployments across the enterprise. ".repeat(8)
    )
  );
  assert.ok(job);
  assert.deepEqual(job.tools, ["Intune"]);
  assert.ok(job.tags.includes("Intune"));
  assert.deepEqual(job.platforms, ["Windows"]);
  assert.match(job.description ?? "", /Intune/);
});
