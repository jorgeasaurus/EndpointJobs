import assert from "node:assert/strict";
import test from "node:test";

import { partitionJobCountryCodes } from "../job-refresh/high-volume-countries";
import { theirStackProvider } from "../job-refresh/providers/theirstack";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("TheirStack splits US/EU and LATAM country codes into separate limit batches", () => {
  assert.deepEqual(
    partitionJobCountryCodes(["US", "CH", "IT", "ES", "FR", "DE", "BR", "AR", "MX", "EC", "PR"]),
    [
      ["US", "CH", "IT", "ES", "FR", "DE"],
      ["BR", "AR", "MX", "EC", "PR"]
    ]
  );
  assert.deepEqual(partitionJobCountryCodes(["US", "DE"]), [["US", "DE"]]);
  assert.deepEqual(partitionJobCountryCodes(["AR", "EC", "DO"]), [["AR", "EC", "DO"]]);
});

test("TheirStack role search posts one request per country batch", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const bodies: Array<Record<string, unknown>> = [];

  process.env.THEIRSTACK_API_KEY = "test-key";
  process.env.JOB_THEIRSTACK_TITLE_QUERIES = "endpoint engineer";
  process.env.JOB_THEIRSTACK_COMPANY_NAMES = " ";
  process.env.JOB_THEIRSTACK_COUNTRY_CODES = "US,DE,BR,AR,EC";
  process.env.JOB_THEIRSTACK_LIMIT = "25";
  process.env.JOB_THEIRSTACK_MAX_PAGES = "1";
  globalThis.fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return Response.json({ data: [] });
  };

  try {
    await theirStackProvider.fetchJobs({
      url: theirStackProvider.defaultUrl,
      fetchedAt: new Date("2026-08-30T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.deepEqual(
    bodies.map((body) => body.job_country_code_or),
    [
      ["US", "DE"],
      ["BR", "AR", "EC"]
    ]
  );
  assert.equal(bodies[0]?.limit, 25);
  assert.equal(bodies[1]?.limit, 25);
});
