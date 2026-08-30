import assert from "node:assert/strict";
import test from "node:test";

import {
  getRapidApiDailyJobsHasSalary,
  getRapidApiDailyJobsQueries,
  rapidApiDailyJobsProvider
} from "../job-refresh/providers/rapidapi-daily-jobs";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("RapidAPI Daily keeps salary-required empty queries for US/EU and relaxes LATAM", () => {
  assert.deepEqual(getRapidApiDailyJobsQueries("us"), [""]);
  assert.deepEqual(getRapidApiDailyJobsQueries("de"), [""]);
  assert.deepEqual(getRapidApiDailyJobsQueries("ar"), ["endpoint"]);
  assert.deepEqual(getRapidApiDailyJobsQueries("ec"), ["endpoint"]);
  assert.deepEqual(getRapidApiDailyJobsQueries("pr"), ["endpoint"]);
  assert.equal(getRapidApiDailyJobsHasSalary("us"), "true");
  assert.equal(getRapidApiDailyJobsHasSalary("mx"), "false");
  assert.equal(getRapidApiDailyJobsHasSalary("do"), "false");
});

test("RapidAPI Daily requests omit hasSalary for LATAM and send an endpoint query", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const urls: URL[] = [];

  process.env.RAPIDAPI_DAILY_JOBS_KEY = "test-key";
  process.env.JOB_RAPIDAPI_COUNTRY_CODES = "us,ar";
  process.env.JOB_RAPIDAPI_HAS_SALARY = "true";
  process.env.JOB_RAPIDAPI_MAX_PAGES = "1";
  delete process.env.JOB_RAPIDAPI_QUERIES;
  delete process.env.JOB_RAPIDAPI_LATAM_QUERIES;
  delete process.env.JOB_RAPIDAPI_LATAM_HAS_SALARY;
  globalThis.fetch = async (input) => {
    urls.push(new URL(String(input)));
    return Response.json({ result: [] });
  };

  try {
    await rapidApiDailyJobsProvider.fetchJobs({
      url: rapidApiDailyJobsProvider.defaultUrl,
      fetchedAt: new Date("2026-08-30T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(urls.length, 2);
  assert.equal(urls[0]?.searchParams.get("countryCode"), "us");
  assert.equal(urls[0]?.searchParams.get("hasSalary"), "true");
  assert.equal(urls[0]?.searchParams.get("query"), null);
  assert.equal(urls[1]?.searchParams.get("countryCode"), "ar");
  assert.equal(urls[1]?.searchParams.get("hasSalary"), "false");
  assert.equal(urls[1]?.searchParams.get("query"), "endpoint");
});
