import assert from "node:assert/strict";
import test from "node:test";

import {
  getRapidApiDailyJobsHasSalary,
  getRapidApiDailyJobsMaxPages,
  getRapidApiDailyJobsMaxRequestsPerRun,
  getRapidApiDailyJobsMonthlyRequestBudget,
  getRapidApiDailyJobsQueries,
  getRapidApiDailyJobsRequestDelayMs,
  getRapidApiDailyJobsRetryDelayMs,
  isRapidApiDailyJobsRateLimitError,
  prioritizeRapidApiCountryCodes,
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

function emptyPage() {
  return Response.json({ result: [] });
}

function jobPage(count = 10, page = 1) {
  return Response.json({
    result: Array.from({ length: count }, (_, index) => ({
      title: `Endpoint Engineer ${page}-${index}`,
      company: "Acme",
      url: `https://example.com/jobs/${page}-${index}`
    }))
  });
}

async function withRapidApiEnv(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  run: () => Promise<void>
) {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.RAPIDAPI_DAILY_JOBS_KEY = "test-key";
  process.env.JOB_RAPIDAPI_REQUEST_DELAY_MS = "0";
  process.env.JOB_RAPIDAPI_RETRY_DELAY_MS = "0";

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  globalThis.fetch = fetchImpl;

  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }
}

test("RapidAPI Daily keeps salary-required empty queries for US/EU and relaxes Spain and LATAM", () => {
  const originalEnv = { ...process.env };
  delete process.env.JOB_RAPIDAPI_QUERIES;
  delete process.env.JOB_RAPIDAPI_LATAM_QUERIES;
  delete process.env.JOB_RAPIDAPI_SPAIN_QUERIES;
  delete process.env.JOB_RAPIDAPI_HAS_SALARY;
  delete process.env.JOB_RAPIDAPI_LATAM_HAS_SALARY;

  try {
    assert.deepEqual(getRapidApiDailyJobsQueries("us"), [""]);
    assert.deepEqual(getRapidApiDailyJobsQueries("de"), [""]);
    assert.deepEqual(getRapidApiDailyJobsQueries("ch"), [""]);
    assert.deepEqual(getRapidApiDailyJobsQueries("es"), ["endpoint"]);
    assert.deepEqual(getRapidApiDailyJobsQueries("ar"), ["endpoint"]);
    assert.deepEqual(getRapidApiDailyJobsQueries("ec"), ["endpoint"]);
    assert.deepEqual(getRapidApiDailyJobsQueries("pr"), ["endpoint"]);
    assert.equal(getRapidApiDailyJobsHasSalary("us"), "true");
    assert.equal(getRapidApiDailyJobsHasSalary("it"), "true");
    assert.equal(getRapidApiDailyJobsHasSalary("fr"), "true");
    assert.equal(getRapidApiDailyJobsHasSalary("es"), "false");
    assert.equal(getRapidApiDailyJobsHasSalary("mx"), "false");
    assert.equal(getRapidApiDailyJobsHasSalary("do"), "false");
  } finally {
    restoreProcessEnv(originalEnv);
  }
});

test("RapidAPI Daily Spain queries fall back to the LATAM list unless JOB_RAPIDAPI_SPAIN_QUERIES is set", () => {
  const originalEnv = { ...process.env };
  delete process.env.JOB_RAPIDAPI_QUERIES;
  process.env.JOB_RAPIDAPI_LATAM_QUERIES = "endpoint";
  delete process.env.JOB_RAPIDAPI_SPAIN_QUERIES;

  try {
    assert.deepEqual(getRapidApiDailyJobsQueries("es"), ["endpoint"]);
    process.env.JOB_RAPIDAPI_SPAIN_QUERIES = "endpoint,intune";
    assert.deepEqual(getRapidApiDailyJobsQueries("es"), ["endpoint", "intune"]);
    assert.deepEqual(getRapidApiDailyJobsQueries("mx"), ["endpoint"]);
  } finally {
    restoreProcessEnv(originalEnv);
  }
});

test("RapidAPI Daily pagination helpers keep US/EU conservative and raise Spain/LATAM", () => {
  const originalEnv = { ...process.env };
  delete process.env.JOB_RAPIDAPI_MAX_PAGES;
  delete process.env.JOB_RAPIDAPI_LATAM_MAX_PAGES;
  delete process.env.JOB_RAPIDAPI_SPAIN_MAX_PAGES;

  try {
    assert.equal(getRapidApiDailyJobsMaxPages("us"), 1);
    assert.equal(getRapidApiDailyJobsMaxPages("es"), 1);
    assert.equal(getRapidApiDailyJobsMaxPages("ar"), 1);

    process.env.JOB_RAPIDAPI_MAX_PAGES = "1";
    process.env.JOB_RAPIDAPI_LATAM_MAX_PAGES = "3";
    process.env.JOB_RAPIDAPI_SPAIN_MAX_PAGES = "5";

    assert.equal(getRapidApiDailyJobsMaxPages("us"), 1);
    assert.equal(getRapidApiDailyJobsMaxPages("de"), 1);
    assert.equal(getRapidApiDailyJobsMaxPages("es"), 5);
    assert.equal(getRapidApiDailyJobsMaxPages("mx"), 3);
  } finally {
    restoreProcessEnv(originalEnv);
  }
});

test("RapidAPI Daily budget helpers leave Pro headroom and derive a per-run cap", () => {
  const originalEnv = { ...process.env };
  delete process.env.JOB_RAPIDAPI_MONTHLY_REQUEST_BUDGET;
  delete process.env.JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN;
  delete process.env.JOB_RAPIDAPI_REQUEST_DELAY_MS;
  delete process.env.JOB_RAPIDAPI_RETRY_DELAY_MS;

  try {
    assert.equal(getRapidApiDailyJobsMonthlyRequestBudget(), 2700);
    assert.equal(getRapidApiDailyJobsMaxRequestsPerRun(), 87);
    assert.equal(getRapidApiDailyJobsRequestDelayMs(), 650);
    assert.equal(getRapidApiDailyJobsRetryDelayMs(), 1500);

    process.env.JOB_RAPIDAPI_MONTHLY_REQUEST_BUDGET = "2700";
    process.env.JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN = "80";
    process.env.JOB_RAPIDAPI_REQUEST_DELAY_MS = "0";
    process.env.JOB_RAPIDAPI_RETRY_DELAY_MS = "0";

    assert.equal(getRapidApiDailyJobsMaxRequestsPerRun(), 80);
    assert.equal(getRapidApiDailyJobsRequestDelayMs(), 0);
    assert.equal(getRapidApiDailyJobsRetryDelayMs(), 0);
    assert.deepEqual(
      prioritizeRapidApiCountryCodes(["us", "ch", "es", "ar", "mx"]),
      ["es", "ar", "mx", "us", "ch"]
    );
    assert.equal(isRapidApiDailyJobsRateLimitError(new Error("429 Too Many Requests")), true);
    assert.equal(isRapidApiDailyJobsRateLimitError(new Error("500 Internal Server Error")), false);
  } finally {
    restoreProcessEnv(originalEnv);
  }
});

test("RapidAPI Daily requests set hasSalary=false for LATAM and send an endpoint query", async () => {
  const urls: URL[] = [];

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "us,es,ar",
      JOB_RAPIDAPI_HAS_SALARY: "true",
      JOB_RAPIDAPI_MAX_PAGES: "1",
      JOB_RAPIDAPI_LATAM_MAX_PAGES: "1",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "1",
      JOB_RAPIDAPI_QUERIES: undefined,
      JOB_RAPIDAPI_LATAM_QUERIES: undefined,
      JOB_RAPIDAPI_LATAM_HAS_SALARY: undefined
    },
    async (input) => {
      urls.push(new URL(String(input)));
      return emptyPage();
    },
    async () => {
      await rapidApiDailyJobsProvider.fetchJobs({
        url: rapidApiDailyJobsProvider.defaultUrl,
        fetchedAt: new Date("2026-08-30T12:00:00.000Z")
      });
    }
  );

  assert.equal(urls.length, 3);
  assert.deepEqual(
    urls.map((url) => url.searchParams.get("countryCode")),
    ["es", "ar", "us"]
  );

  const byCountry = Object.fromEntries(
    urls.map((url) => [url.searchParams.get("countryCode"), url])
  );
  assert.equal(byCountry.us?.searchParams.get("hasSalary"), "true");
  assert.equal(byCountry.us?.searchParams.get("query"), null);
  assert.equal(byCountry.es?.searchParams.get("hasSalary"), "false");
  assert.equal(byCountry.es?.searchParams.get("query"), "endpoint");
  assert.equal(byCountry.ar?.searchParams.get("hasSalary"), "false");
  assert.equal(byCountry.ar?.searchParams.get("query"), "endpoint");
});

test("RapidAPI Daily paginates Spain and LATAM until empty and keeps US/EU on one page", async () => {
  const urls: URL[] = [];

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "us,es,ar",
      JOB_RAPIDAPI_MAX_PAGES: "1",
      JOB_RAPIDAPI_LATAM_MAX_PAGES: "3",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "5",
      JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN: "80"
    },
    async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      const page = Number(url.searchParams.get("page"));
      const country = url.searchParams.get("countryCode");

      if (country === "us") {
        return jobPage(10, page);
      }

      if (country === "es") {
        return page < 4 ? jobPage(10, page) : emptyPage();
      }

      return page < 3 ? jobPage(10, page) : emptyPage();
    },
    async () => {
      await rapidApiDailyJobsProvider.fetchJobs({
        url: rapidApiDailyJobsProvider.defaultUrl,
        fetchedAt: new Date("2026-08-30T12:00:00.000Z")
      });
    }
  );

  assert.deepEqual(
    urls.map((url) => `${url.searchParams.get("countryCode")}:${url.searchParams.get("page")}`),
    ["es:1", "es:2", "es:3", "es:4", "ar:1", "ar:2", "ar:3", "us:1"]
  );
});

test("RapidAPI Daily stops at the per-run request budget", async () => {
  const urls: URL[] = [];

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es,ar,mx",
      JOB_RAPIDAPI_MAX_PAGES: "1",
      JOB_RAPIDAPI_LATAM_MAX_PAGES: "3",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "5",
      JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN: "2"
    },
    async (input) => {
      urls.push(new URL(String(input)));
      return jobPage();
    },
    async () => {
      await rapidApiDailyJobsProvider.fetchJobs({
        url: rapidApiDailyJobsProvider.defaultUrl,
        fetchedAt: new Date("2026-08-30T12:00:00.000Z")
      });
    }
  );

  assert.equal(urls.length, 2);
  assert.deepEqual(
    urls.map((url) => `${url.searchParams.get("countryCode")}:${url.searchParams.get("page")}`),
    ["es:1", "es:2"]
  );
});

test("RapidAPI Daily retries once on 429 then continues", async () => {
  let attempts = 0;
  const statuses: number[] = [];

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "1",
      JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN: "5"
    },
    async () => {
      attempts += 1;
      if (attempts === 1) {
        statuses.push(429);
        return new Response("Too Many Requests", {
          status: 429,
          statusText: "Too Many Requests"
        });
      }

      statuses.push(200);
      return jobPage();
    },
    async () => {
      const jobs = await rapidApiDailyJobsProvider.fetchJobs({
        url: rapidApiDailyJobsProvider.defaultUrl,
        fetchedAt: new Date("2026-08-30T12:00:00.000Z")
      });
      assert.equal(jobs.filter(Boolean).length, 10);
    }
  );

  assert.deepEqual(statuses, [429, 200]);
  assert.equal(attempts, 2);
});

test("RapidAPI Daily stops after repeated 429s and does not keep paging", async () => {
  let attempts = 0;

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es,ar",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "3",
      JOB_RAPIDAPI_LATAM_MAX_PAGES: "3",
      JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN: "20"
    },
    async () => {
      attempts += 1;
      return new Response("Too Many Requests", {
        status: 429,
        statusText: "Too Many Requests"
      });
    },
    async () => {
      await assert.rejects(
        rapidApiDailyJobsProvider.fetchJobs({
          url: rapidApiDailyJobsProvider.defaultUrl,
          fetchedAt: new Date("2026-08-30T12:00:00.000Z")
        }),
        /429 Too Many Requests/
      );
    }
  );

  assert.equal(attempts, 2);
});

test("RapidAPI Daily caps pageSize at the API maximum of 10", async () => {
  const urls: URL[] = [];

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "1",
      JOB_RAPIDAPI_PAGE_SIZE: "50"
    },
    async (input) => {
      urls.push(new URL(String(input)));
      return emptyPage();
    },
    async () => {
      await rapidApiDailyJobsProvider.fetchJobs({
        url: rapidApiDailyJobsProvider.defaultUrl,
        fetchedAt: new Date("2026-08-30T12:00:00.000Z")
      });
    }
  );

  assert.equal(urls[0]?.searchParams.get("pageSize"), "10");
});
