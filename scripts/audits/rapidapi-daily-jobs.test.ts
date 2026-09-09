import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultRapidApiDailyTitleTerms,
  getRapidApiDailyJobsDateRange,
  getRapidApiDailyJobsHasSalary,
  getRapidApiDailyJobsLookbackDays,
  getRapidApiDailyJobsMaxPages,
  getRapidApiDailyJobsMaxRequestsPerRun,
  getRapidApiDailyJobsMonthlyRequestBudget,
  getRapidApiDailyJobsQueries,
  getRapidApiDailyJobsQueryParam,
  getRapidApiDailyJobsRequestDelayMs,
  getRapidApiDailyJobsRetryDelayMs,
  getRapidApiDailyJobsSearchQueries,
  isRapidApiDailyJobsRateLimitError,
  joinRapidApiDailyTitleTerms,
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

function rateLimitedResponse(onCancel: () => void) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Too Many Requests"));
      },
      cancel() {
        onCancel();
      }
    }),
    {
      status: 429,
      statusText: "Too Many Requests"
    }
  );
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
  delete process.env.JOB_RAPIDAPI_QUERY_PARAM;
  delete process.env.JOB_RAPIDAPI_LOOKBACK_DAYS;
  delete process.env.JOB_RAPIDAPI_DATE_CREATED;

  try {
    assert.deepEqual(getRapidApiDailyJobsQueries("us"), [""]);
    assert.deepEqual(getRapidApiDailyJobsQueries("de"), [""]);
    assert.deepEqual(getRapidApiDailyJobsQueries("ch"), [""]);
    assert.deepEqual(getRapidApiDailyJobsQueries("es"), [...defaultRapidApiDailyTitleTerms]);
    assert.deepEqual(getRapidApiDailyJobsQueries("ar"), [...defaultRapidApiDailyTitleTerms]);
    assert.deepEqual(getRapidApiDailyJobsQueries("ec"), [...defaultRapidApiDailyTitleTerms]);
    assert.deepEqual(getRapidApiDailyJobsQueries("pr"), [...defaultRapidApiDailyTitleTerms]);
    assert.deepEqual(getRapidApiDailyJobsSearchQueries("es"), [
      joinRapidApiDailyTitleTerms([...defaultRapidApiDailyTitleTerms])
    ]);
    assert.deepEqual(getRapidApiDailyJobsSearchQueries("us"), [""]);
    assert.equal(getRapidApiDailyJobsQueryParam(), "title");
    assert.equal(getRapidApiDailyJobsLookbackDays(), 30);
    assert.deepEqual(
      getRapidApiDailyJobsDateRange(new Date("2026-08-30T12:00:00.000Z")),
      { dateCreatedMin: "2026-07-31", dateCreatedMax: "2026-08-30" }
    );
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

test("RapidAPI Daily query param trims whitespace and falls back to title when empty", () => {
  const originalEnv = { ...process.env };

  try {
    delete process.env.JOB_RAPIDAPI_QUERY_PARAM;
    assert.equal(getRapidApiDailyJobsQueryParam(), "title");

    process.env.JOB_RAPIDAPI_QUERY_PARAM = "  title  ";
    assert.equal(getRapidApiDailyJobsQueryParam(), "title");

    process.env.JOB_RAPIDAPI_QUERY_PARAM = "   ";
    assert.equal(getRapidApiDailyJobsQueryParam(), "title");

    process.env.JOB_RAPIDAPI_QUERY_PARAM = "";
    assert.equal(getRapidApiDailyJobsQueryParam(), "title");

    process.env.JOB_RAPIDAPI_QUERY_PARAM = "  skills  ";
    assert.equal(getRapidApiDailyJobsQueryParam(), "skills");
  } finally {
    restoreProcessEnv(originalEnv);
  }
});

test("RapidAPI Daily Spain queries fall back to the LATAM list unless JOB_RAPIDAPI_SPAIN_QUERIES is set", () => {
  const originalEnv = { ...process.env };
  delete process.env.JOB_RAPIDAPI_QUERIES;
  process.env.JOB_RAPIDAPI_LATAM_QUERIES = "intune,jamf,mdm,uem,endpoint";
  delete process.env.JOB_RAPIDAPI_SPAIN_QUERIES;

  try {
    assert.deepEqual(getRapidApiDailyJobsQueries("es"), [
      "intune",
      "jamf",
      "mdm",
      "uem",
      "endpoint"
    ]);
    assert.deepEqual(getRapidApiDailyJobsSearchQueries("es"), [
      "intune,jamf,mdm,uem,endpoint"
    ]);
    process.env.JOB_RAPIDAPI_SPAIN_QUERIES = "intune,ingeniero endpoint";
    assert.deepEqual(getRapidApiDailyJobsQueries("es"), ["intune", "ingeniero endpoint"]);
    assert.deepEqual(getRapidApiDailyJobsSearchQueries("es"), ["intune,ingeniero endpoint"]);
    assert.deepEqual(getRapidApiDailyJobsSearchQueries("mx"), [
      "intune,jamf,mdm,uem,endpoint"
    ]);
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

test("RapidAPI Daily requests set hasSalary=false for LATAM and send a title OR", async () => {
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
      JOB_RAPIDAPI_LATAM_HAS_SALARY: undefined,
      JOB_RAPIDAPI_QUERY_PARAM: undefined,
      JOB_RAPIDAPI_LOOKBACK_DAYS: undefined,
      JOB_RAPIDAPI_DATE_CREATED: undefined
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
  const expectedTitle = joinRapidApiDailyTitleTerms([...defaultRapidApiDailyTitleTerms]);
  assert.equal(byCountry.us?.searchParams.get("hasSalary"), "true");
  assert.equal(byCountry.us?.searchParams.get("query"), null);
  assert.equal(byCountry.us?.searchParams.get("title"), null);
  assert.equal(byCountry.es?.searchParams.get("hasSalary"), "false");
  assert.equal(byCountry.es?.searchParams.get("query"), null);
  assert.equal(byCountry.es?.searchParams.get("title"), expectedTitle);
  assert.equal(byCountry.ar?.searchParams.get("hasSalary"), "false");
  assert.equal(byCountry.ar?.searchParams.get("query"), null);
  assert.equal(byCountry.ar?.searchParams.get("title"), expectedTitle);
  assert.equal(byCountry.es?.searchParams.get("dateCreatedMin"), "2026-07-31");
  assert.equal(byCountry.es?.searchParams.get("dateCreatedMax"), "2026-08-30");
  assert.equal(byCountry.us?.searchParams.get("dateCreatedMin"), "2026-07-31");
  assert.equal(byCountry.us?.searchParams.get("dateCreatedMax"), "2026-08-30");
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
  let canceledBodies = 0;
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
        return rateLimitedResponse(() => {
          canceledBodies += 1;
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
  assert.equal(canceledBodies, 1);
});

test("RapidAPI Daily stops after repeated 429s and does not keep paging", async () => {
  let attempts = 0;
  let canceledBodies = 0;

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es,ar",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "3",
      JOB_RAPIDAPI_LATAM_MAX_PAGES: "3",
      JOB_RAPIDAPI_MAX_REQUESTS_PER_RUN: "20"
    },
    async () => {
      attempts += 1;
      return rateLimitedResponse(() => {
        canceledBodies += 1;
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
  assert.equal(canceledBodies, 2);
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

test("RapidAPI Daily joins CSV title terms into one request per country", async () => {
  const urls: URL[] = [];

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es,mx",
      JOB_RAPIDAPI_LATAM_QUERIES: "intune,jamf,mdm",
      JOB_RAPIDAPI_SPAIN_QUERIES: "intune,jamf,mdm",
      JOB_RAPIDAPI_MAX_PAGES: "1",
      JOB_RAPIDAPI_LATAM_MAX_PAGES: "1",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "1"
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

  assert.equal(urls.length, 2);
  assert.deepEqual(
    urls.map((url) => `${url.searchParams.get("countryCode")}:${url.searchParams.get("title")}`),
    ["es:intune,jamf,mdm", "mx:intune,jamf,mdm"]
  );
});

test("RapidAPI Daily honors an explicit dateCreated override", async () => {
  const urls: URL[] = [];

  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "1",
      JOB_RAPIDAPI_DATE_CREATED: "2026-08"
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

  assert.equal(urls[0]?.searchParams.get("dateCreated"), "2026-08");
  assert.equal(urls[0]?.searchParams.get("dateCreatedMin"), null);
  assert.equal(urls[0]?.searchParams.get("dateCreatedMax"), null);
});

test("RapidAPI Daily keeps Intune/MDM titles and drops generic IT rows without leaking the search OR into tags", async () => {
  await withRapidApiEnv(
    {
      JOB_RAPIDAPI_COUNTRY_CODES: "es",
      JOB_RAPIDAPI_SPAIN_QUERIES: "intune,jamf,mdm,uem,endpoint",
      JOB_RAPIDAPI_SPAIN_MAX_PAGES: "1"
    },
    async () => {
      return Response.json({
        result: [
          {
            title: "Ingeniero Intune",
            company: "Acme Madrid",
            url: "https://example.com/jobs/intune-es",
            city: "Madrid",
            countryCode: "es",
            occupation: "engineer",
            skills: ["Intune"]
          },
          {
            title: "Especialista MDM",
            company: "Acme Bogota",
            url: "https://example.com/jobs/mdm-co",
            city: "Bogotá",
            countryCode: "co",
            occupation: "specialist"
          },
          {
            title: "Network Operations Analyst",
            company: "Generic Telco",
            url: "https://example.com/jobs/network-ops",
            city: "Madrid",
            countryCode: "es",
            occupation: "analyst",
            industry: "it",
            skills: ["cisco", "routing"]
          }
        ]
      });
    },
    async () => {
      const jobs = await rapidApiDailyJobsProvider.fetchJobs({
        url: rapidApiDailyJobsProvider.defaultUrl,
        fetchedAt: new Date("2026-08-30T12:00:00.000Z")
      });
      const surviving = jobs.filter((job) => job !== null);

      assert.deepEqual(
        surviving.map((job) => job.title),
        ["Ingeniero Intune", "Especialista MDM"]
      );
      assert.ok(
        surviving.every((job) => job.source === "RapidAPI Daily International Jobs")
      );
      assert.ok(
        surviving.every((job) => job.attributionLabel === "Daily International Jobs via RapidAPI")
      );
      assert.ok(
        surviving.every((job) => !job.tags.some((tag) => tag.includes("intune,jamf,mdm,uem,endpoint")))
      );
    }
  );
});
