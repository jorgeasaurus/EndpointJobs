import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSerpApiGoogleJob,
  serpApiProvider
} from "../job-refresh/providers/serpapi";

function restoreProcessEnv(originalEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test("SerpAPI preserves successful query results when a later query fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  let requestCount = 0;

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer,intune engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  globalThis.fetch = async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return Response.json({
        jobs_results: [
          {
            job_id: "endpoint-123",
            title: "Endpoint Engineer",
            company_name: "Example Company",
            location: "Remote",
            description: "Manage Microsoft Intune, Windows endpoints, and device automation.",
            apply_options: [{
              title: "Example Company",
              link: "https://example.com/jobs/endpoint-123"
            }]
          },
          {
            job_id: "unrelated-456",
            title: "Account Executive",
            company_name: "Example Company",
            location: "Remote",
            description: "Sell enterprise software subscriptions.",
            apply_options: [{
              title: "Example Company",
              link: "https://example.com/jobs/unrelated-456"
            }]
          }
        ]
      });
    }

    return Response.json({ error: "Your account has run out of searches." });
  };

  let jobs;
  try {
    jobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(requestCount, 2);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.title, "Endpoint Engineer");
});

test("SerpAPI still fails when no query returns successfully", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  globalThis.fetch = async () => new Response('{"error":"Your account has run out of searches."}', {
    status: 429,
    statusText: "Too Many Requests"
  });

  try {
    await assert.rejects(
      serpApiProvider.fetchJobs({
        url: serpApiProvider.defaultUrl,
        fetchedAt: new Date("2026-07-15T12:00:00.000Z")
      }),
      /429 Too Many Requests.*run out of searches/
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }
});

test("SerpAPI searches every configured country with its market localization", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const requestUrls: URL[] = [];

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_COUNTRIES = "us,au";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const country = url.searchParams.get("gl") ?? "unknown";
    requestUrls.push(url);

    return Response.json({
      jobs_results: [{
        job_id: `endpoint-${country}`,
        title: "Endpoint Engineer",
        company_name: "Example Company",
        location: country === "au" ? "Sydney, Australia" : "Austin, TX",
        description: "Manage Microsoft Intune and Windows endpoints.",
        detected_extensions: { salary: "$120K–$140K a year" },
        apply_options: [{
          title: "Example Company",
          link: `https://example.com/jobs/endpoint-${country}`
        }]
      }]
    });
  };

  let jobs;
  try {
    jobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((job) => ({
    currency: job?.salary?.currency,
    max: job?.salary?.max,
    min: job?.salary?.min
  })), [
    { currency: "USD", max: 140_000, min: 120_000 },
    { currency: "AUD", max: 140_000, min: 120_000 }
  ]);
  assert.deepEqual(
    requestUrls.map((url) => ({
      domain: url.searchParams.get("google_domain"),
      gl: url.searchParams.get("gl"),
      hl: url.searchParams.get("hl"),
      location: url.searchParams.get("location")
    })),
    [
      { domain: "google.com", gl: "us", hl: "en", location: "United States" },
      { domain: "google.com.au", gl: "au", hl: "en", location: "Australia" }
    ]
  );
});

test("SerpAPI allocates searches from market-specific query pools", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const searches: string[] = [];

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_COUNTRIES = "us,au";
  process.env.JOB_SERPAPI_QUERIES = "fallback endpoint engineer";
  process.env.JOB_SERPAPI_US_QUERIES = "endpoint engineer,desktop engineer,jamf engineer";
  process.env.JOB_SERPAPI_AU_QUERIES = "intune engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  process.env.JOB_SERPAPI_MAX_SEARCHES_PER_RUN = "4";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const country = url.searchParams.get("gl") ?? "unknown";
    const query = url.searchParams.get("q") ?? "unknown";
    const key = `${query}/${country}`;
    searches.push(key);

    return Response.json({
      jobs_results: [{
        job_id: key,
        title: "Endpoint Engineer",
        company_name: "Example Company",
        location: country === "au" ? "Sydney, Australia" : "Austin, TX",
        description: "Manage Microsoft Intune and Windows endpoints.",
        apply_options: [{
          title: "Example Company",
          link: `https://example.com/jobs/${encodeURIComponent(key)}`
        }]
      }]
    });
  };

  try {
    await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-16T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.deepEqual(searches, [
    "endpoint engineer/us",
    "intune engineer/au",
    "desktop engineer/us",
    "jamf engineer/us"
  ]);
});

test("SerpAPI preserves numeric bounds from explicit Australian salary labels", () => {
  const jobs = ["AUD 120K–140K a year", "A$120K–A$140K a year"].map((salary, index) =>
    normalizeSerpApiGoogleJob({
      job_id: `endpoint-au-${index}`,
      title: "Endpoint Engineer",
      company_name: "Example Company",
      location: "Sydney, Australia",
      description: "Manage Microsoft Intune and Windows endpoints.",
      detected_extensions: { salary },
      apply_options: [{
        title: "Example Company",
        link: `https://example.com/jobs/endpoint-au-${index}`
      }]
    }, "endpoint engineer", new Date("2026-07-15T12:00:00.000Z"), "AUD")
  );

  assert.deepEqual(jobs.map((job) => job?.salary), [
    { currency: "AUD", label: "AUD 120K–140K a year", max: 140_000, min: 120_000 },
    { currency: "AUD", label: "A$120K–A$140K a year", max: 140_000, min: 120_000 }
  ]);
});

test("SerpAPI applies its request cap fairly across configured countries", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const searches: string[] = [];

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_COUNTRIES = "us,au";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer,intune engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  process.env.JOB_SERPAPI_MAX_SEARCHES_PER_RUN = "3";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const country = url.searchParams.get("gl") ?? "unknown";
    const query = url.searchParams.get("q") ?? "unknown";
    const key = `${query}/${country}`;
    searches.push(key);

    return Response.json({
      jobs_results: [{
        job_id: key,
        title: query === "intune engineer" ? "Intune Engineer" : "Endpoint Engineer",
        company_name: "Example Company",
        location: country === "au" ? "Sydney, Australia" : "Austin, TX",
        description: "Manage Microsoft Intune and Windows endpoints.",
        apply_options: [{
          title: "Example Company",
          link: `https://example.com/jobs/${encodeURIComponent(key)}`
        }]
      }]
    });
  };

  let jobs;
  try {
    jobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(jobs.length, 3);
  assert.deepEqual(searches, [
    "endpoint engineer/us",
    "endpoint engineer/au",
    "intune engineer/us"
  ]);
});

test("SerpAPI continues with other countries after a market request fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const searchedCountries: string[] = [];

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_COUNTRIES = "us,au";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer,intune engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const country = url.searchParams.get("gl") ?? "unknown";
    searchedCountries.push(country);

    if (country === "us") {
      return new Response("upstream unavailable", {
        status: 503,
        statusText: "Service Unavailable"
      });
    }

    const query = url.searchParams.get("q") ?? "unknown";
    return Response.json({
      jobs_results: [{
        job_id: `${query}-au`,
        title: query === "intune engineer" ? "Intune Engineer" : "Endpoint Engineer",
        company_name: "Example Company",
        location: "Sydney, Australia",
        description: "Manage Microsoft Intune and Windows endpoints.",
        apply_options: [{
          title: "Example Company",
          link: `https://example.com/jobs/${encodeURIComponent(query)}-au`
        }]
      }]
    });
  };

  let jobs;
  try {
    jobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.deepEqual(searchedCountries, ["us", "au", "au"]);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0]?.location, "Sydney, Australia");
});

test("SerpAPI quota preflight preserves the configured monthly reserve", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const searches: string[] = [];
  let accountRequests = 0;
  let remainingSearches = 102;

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_COUNTRIES = "us,au";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer,intune engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "1";
  process.env.JOB_SERPAPI_MAX_SEARCHES_PER_RUN = "28";
  process.env.JOB_SERPAPI_MONTHLY_RESERVE = "100";
  process.env.JOB_SERPAPI_QUOTA_PREFLIGHT = "true";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));

    if (url.pathname === "/account.json") {
      accountRequests += 1;
      return Response.json({ plan_searches_left: remainingSearches });
    }

    const country = url.searchParams.get("gl") ?? "unknown";
    const query = url.searchParams.get("q") ?? "unknown";
    const key = `${query}/${country}`;
    searches.push(key);

    return Response.json({
      jobs_results: [{
        job_id: key,
        title: query === "intune engineer" ? "Intune Engineer" : "Endpoint Engineer",
        company_name: "Example Company",
        location: country === "au" ? "Sydney, Australia" : "Austin, TX",
        description: "Manage Microsoft Intune and Windows endpoints.",
        apply_options: [{
          title: "Example Company",
          link: `https://example.com/jobs/${encodeURIComponent(key)}`
        }]
      }]
    });
  };

  let jobs;
  let stoppedJobs;
  try {
    jobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
    remainingSearches = 100;
    stoppedJobs = await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.equal(accountRequests, 2);
  assert.equal(jobs.length, 2);
  assert.equal(stoppedJobs.length, 0);
  assert.deepEqual(searches, ["endpoint engineer/us", "endpoint engineer/au"]);
});

test("SerpAPI gives every country a first page before spending on pagination", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const searches: string[] = [];

  process.env.SERPAPI_API_KEY = "test-key";
  process.env.JOB_SERPAPI_COUNTRIES = "us,au";
  process.env.JOB_SERPAPI_QUERIES = "endpoint engineer";
  process.env.JOB_SERPAPI_MAX_PAGES = "2";
  process.env.JOB_SERPAPI_MAX_SEARCHES_PER_RUN = "2";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const country = url.searchParams.get("gl") ?? "unknown";
    const page = url.searchParams.has("next_page_token") ? 2 : 1;
    const key = `${country}/page-${page}`;
    searches.push(key);

    return Response.json({
      jobs_results: [{
        job_id: key,
        title: "Endpoint Engineer",
        company_name: "Example Company",
        location: country === "au" ? "Sydney, Australia" : "Austin, TX",
        description: "Manage Microsoft Intune and Windows endpoints.",
        apply_options: [{
          title: "Example Company",
          link: `https://example.com/jobs/${key}`
        }]
      }],
      serpapi_pagination: { next_page_token: `${country}-next` }
    });
  };

  try {
    await serpApiProvider.fetchJobs({
      url: serpApiProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
    restoreProcessEnv(originalEnv);
  }

  assert.deepEqual(searches, ["us/page-1", "au/page-1"]);
});
