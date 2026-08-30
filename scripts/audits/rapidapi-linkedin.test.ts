import assert from "node:assert/strict";
import test from "node:test";

import {
  getRapidApiLinkedInLocationFilters,
  rapidApiLinkedInProvider
} from "../job-refresh/providers/rapidapi-linkedin";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("LinkedIn primary location filter treats blank env as unset", () => {
  const originalEnv = { ...process.env };

  delete process.env.JOB_RAPIDAPI_LINKEDIN_LATAM_LOCATION_FILTER;

  try {
    process.env.JOB_RAPIDAPI_LINKEDIN_LOCATION_FILTER = "";
    assert.deepEqual(getRapidApiLinkedInLocationFilters(), [
      '"United States" OR "Remote"'
    ]);

    process.env.JOB_RAPIDAPI_LINKEDIN_LOCATION_FILTER = "   ";
    assert.deepEqual(getRapidApiLinkedInLocationFilters(), [
      '"United States" OR "Remote"'
    ]);
  } finally {
    restoreProcessEnv(originalEnv);
  }
});

test("LinkedIn location filters keep US/EU/Remote separate from the LATAM batch", () => {
  const originalEnv = { ...process.env };

  process.env.JOB_RAPIDAPI_LINKEDIN_LOCATION_FILTER =
    '"United States" OR "Germany" OR "Remote"';
  process.env.JOB_RAPIDAPI_LINKEDIN_LATAM_LOCATION_FILTER =
    '"Ecuador" OR "Puerto Rico" OR "Caribbean"';

  try {
    assert.deepEqual(getRapidApiLinkedInLocationFilters(), [
      '"United States" OR "Germany" OR "Remote"',
      '"Ecuador" OR "Puerto Rico" OR "Caribbean"'
    ]);
  } finally {
    restoreProcessEnv(originalEnv);
  }
});

test("LinkedIn searches each title against both location batches", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const urls: URL[] = [];

  process.env.RAPIDAPI_LINKEDIN_JOBS_KEY = "test-key";
  process.env.JOB_RAPIDAPI_LINKEDIN_TITLE_FILTERS = "Endpoint Engineer";
  process.env.JOB_RAPIDAPI_LINKEDIN_LOCATION_FILTER =
    '"United States" OR "Remote"';
  process.env.JOB_RAPIDAPI_LINKEDIN_LATAM_LOCATION_FILTER =
    '"Ecuador" OR "Caribbean"';
  process.env.JOB_RAPIDAPI_LINKEDIN_LIMIT = "25";
  process.env.JOB_RAPIDAPI_LINKEDIN_MAX_PAGES = "1";
  globalThis.fetch = async (input) => {
    urls.push(new URL(String(input)));
    return Response.json([]);
  };

  try {
    await rapidApiLinkedInProvider.fetchJobs({
      url: rapidApiLinkedInProvider.defaultUrl,
      fetchedAt: new Date("2026-08-30T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(urls.length, 2);
  assert.equal(urls[0]?.searchParams.get("limit"), "25");
  assert.equal(
    urls[0]?.searchParams.get("location_filter"),
    '"United States" OR "Remote"'
  );
  assert.equal(
    urls[1]?.searchParams.get("location_filter"),
    '"Ecuador" OR "Caribbean"'
  );
});
