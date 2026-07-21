import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

import {
  createJobResponse,
  createJobsApiError,
  findActiveJob,
  queryJobs
} from "../../src/lib/jobs-api";
import {
  getJobsApiOpenApiAppliedFiltersSchema,
  getJobsApiOpenApiParameters
} from "../../src/lib/jobs-api-contract";
import type { Job, JobsFeed } from "../../src/types/job";

type RunAudit = (
  id: string,
  detail: string,
  audit: () => Promise<void> | void
) => Promise<void>;

export async function auditJobsApiData(run: RunAudit) {
  await run("FEAT-075", "Jobs API returns filtered pagination metadata", async () => {
    const feed = makeFeed([
      makeJob({ id: "one", tools: ["Jamf"], platforms: ["macOS"] }),
      makeJob({ id: "two", tools: ["Intune"], platforms: ["Windows"] }),
      makeJob({ id: "stale", staleAfter: "2026-07-01T00:00:00.000Z" })
    ]);
    const now = new Date("2026-07-12T00:00:00.000Z");
    const result = queryJobs(
      feed,
      new URLSearchParams("tools=Jamf&page=1&limit=1"),
      now
    );

    assertEqual(result.ok, true, "valid API query");
    if (!result.ok) return;
    assertEqual(result.body.data[0]?.id, "one", "filtered job");
    assertEqual(result.body.meta.total, 1, "filtered total");
    assertEqual(result.body.meta.page, 1, "page metadata");
    assertEqual(result.body.meta.limit, 1, "limit metadata");
    assertEqual(result.body.filters.tools[0], "Jamf", "public applied-filter DTO");
    assertEqual(result.body.filters.leadership, false, "leadership defaults off");
    assertEqual("selectedTools" in result.body.filters, false, "UI filter field excluded");

    const paddedText = queryJobs(feed, new URLSearchParams("q=%20Endpoint%20"), now);
    assertEqual(paddedText.ok, true, "padded text query accepted");
    if (paddedText.ok) {
      assertEqual(paddedText.body.filters.q, "Endpoint", "text query normalized");
    }

    const invalid = queryJobs(feed, new URLSearchParams("limit=101&unknown=1"), now);
    assertEqual(invalid.ok, false, "invalid query rejected");
    if (!invalid.ok) {
      assertEqual(invalid.status, 400, "invalid query status");
      assertEqual(invalid.body.error.code, "INVALID_QUERY", "invalid query code");
    }
    assertEqual(
      queryJobs(feed, new URLSearchParams("freshness=Any"), now).ok,
      false,
      "UI freshness sentinel rejected"
    );
    assertEqual(
      queryJobs(feed, new URLSearchParams("leadership=0"), now).ok,
      false,
      "unsupported leadership value rejected"
    );

    const leadership = queryJobs(
      makeFeed([
        makeJob({ id: "manager", title: "Manager, Endpoint Engineering" }),
        makeJob({ id: "lead", title: "Endpoint Engineering Lead" }),
        makeJob({ id: "staff", title: "Staff Endpoint Engineer" })
      ]),
      new URLSearchParams("leadership=1"),
      now
    );
    assertEqual(leadership.ok && leadership.body.meta.total, 2, "leadership roles filtered");
    assertEqual(leadership.ok && leadership.body.filters.leadership, true, "leadership applied filter returned");

    const metroFeed = makeFeed([
      makeJob({ id: "london", location: "London, UK", workplace: "Hybrid" }),
      makeJob({ id: "berlin", location: "Berlin, Germany", workplace: "On-site" }),
      makeJob({ id: "seattle", location: "Seattle, WA", workplace: "Remote" })
    ]);
    const metro = queryJobs(
      metroFeed,
      new URLSearchParams("metroAreas=London%2C%20UK%7CBerlin%2C%20Germany"),
      now
    );
    assertEqual(metro.ok, true, "pipe-separated metroAreas query accepted");
    if (metro.ok) {
      assertEqual(metro.body.meta.total, 2, "metro areas filtered");
      // Applied filters follow metroAreaOptions order, not query-string order,
      // matching the existing platforms/tools multi-filter behavior.
      assertEqual(
        metro.body.filters.metroAreas.join(" / "),
        "Berlin, Germany / London, UK",
        "metro-area applied filters returned"
      );
    }
    assertEqual(
      queryJobs(metroFeed, new URLSearchParams("metroAreas=Not%20A%20Metro"), now).ok,
      false,
      "unsupported metro area rejected"
    );

    for (const query of ["page=1e2", "limit=0x10"]) {
      assertEqual(
        queryJobs(feed, new URLSearchParams(query), now).ok,
        false,
        `non-decimal integer rejected: ${query}`
      );
    }

    const paddedValues = queryJobs(
      feed,
      new URLSearchParams("workplace=Remote%20&salary=1%20&page=1%20"),
      now
    );
    assertEqual(paddedValues.ok, true, "padded enum and integer values accepted");
    if (paddedValues.ok) {
      assertEqual(paddedValues.body.filters.workplace, "Remote", "enum normalized");
      assertEqual(paddedValues.body.filters.salaryShown, true, "salary flag normalized");
      assertEqual(paddedValues.body.meta.page, 1, "integer normalized");
    }

    const active = queryJobs(feed, new URLSearchParams(), now);
    assertEqual(active.ok && active.body.meta.total, 2, "stale job excluded");
    const empty = queryJobs(feed, new URLSearchParams("q=nonexistent"), now);
    assertEqual(empty.ok && empty.body.meta.totalPages, 1, "empty results retain one page");
    const fresh = queryJobs(
      feed,
      new URLSearchParams("freshness=7"),
      new Date("2026-07-18T00:00:00.000Z")
    );
    assertEqual(fresh.ok && fresh.body.meta.total, 0, "freshness uses injected request time");

    const oneDay = queryJobs(
      makeFeed([
        makeJob({ id: "within-one-day", postedAt: "2026-07-17T00:00:00.001Z" }),
        makeJob({ id: "exactly-one-day", postedAt: "2026-07-17T00:00:00.000Z" }),
        makeJob({ id: "older-than-one-day", postedAt: "2026-07-16T23:59:59.999Z" })
      ]),
      new URLSearchParams("freshness=1"),
      new Date("2026-07-18T00:00:00.000Z")
    );
    assertEqual(oneDay.ok && oneDay.body.meta.total, 1, "one-day freshness filters by posted age");
    assertEqual(oneDay.ok && oneDay.body.data[0]?.id, "within-one-day", "one-day freshness keeps recent jobs");
    assertEqual(oneDay.ok && oneDay.body.filters.freshness, "1", "one-day freshness is returned in applied filters");

    assertEqual(findActiveJob(feed, "one", now)?.id, "one", "active job lookup");
    assertEqual(findActiveJob(feed, "stale", now), undefined, "stale job lookup excluded");

    const specification = JSON.parse(
      await readFile("public/openapi.json", "utf8")
    ) as Record<string, unknown>;
    assertEqual(specification.openapi, "3.1.0", "OpenAPI version");
    assertTruthy(readPointer(specification, "#/paths/~1api~1jobs/get"), "collection path");
    assertTruthy(readPointer(specification, "#/paths/~1api~1jobs~1{id}/get"), "item path");
    assertLocalReferencesResolve(specification);
    assertTruthy(
      (readPointer(specification, "#/paths/~1api~1jobs/get/parameters") as Array<{ $ref?: string }>)
        .some((parameter) => parameter.$ref === "#/components/parameters/Leadership"),
      "collection leadership parameter"
    );
    assertEqual(
      (readPointer(specification, "#/components/parameters/MetroAreas") as { style?: string }).style,
      "pipeDelimited",
      "metroAreas documented as pipe-delimited"
    );
    assertDeepEqual(
      readPointer(specification, "#/components/parameters"),
      getJobsApiOpenApiParameters(),
      "OpenAPI query parameters match canonical contract"
    );
    assertDeepEqual(
      readPointer(specification, "#/components/schemas/Filters"),
      getJobsApiOpenApiAppliedFiltersSchema(),
      "OpenAPI applied filters match canonical contract"
    );
    assertSchema(specification, "#/components/schemas/JobCollection", result.body);
    if (oneDay.ok) {
      assertSchema(specification, "#/components/schemas/JobCollection", oneDay.body);
    }
    if (leadership.ok) {
      assertSchema(specification, "#/components/schemas/JobCollection", leadership.body);
    }
    assertSchema(specification, "#/components/schemas/ApiError", invalid.body);
    assertSchema(
      specification,
      "#/components/schemas/JobResponse",
      createJobResponse(feed, feed.jobs[0]!)
    );
    assertSchema(
      specification,
      "#/components/schemas/ApiError",
      createJobsApiError("JOB_NOT_FOUND", "Job listing not found.")
    );
  });
}

function makeFeed(jobs: Job[]): JobsFeed {
  return {
    updatedAt: "2026-07-11T00:00:00.000Z",
    source: { name: "Audit", url: "https://example.com/feed" },
    jobs
  };
}

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: "job",
    title: "Endpoint Engineer",
    company: "Audit Company",
    location: "Remote, US",
    workplace: "Remote",
    postedAt: "2026-07-10T00:00:00.000Z",
    fetchedAt: "2026-07-11T00:00:00.000Z",
    staleAfter: "2026-08-10T00:00:00.000Z",
    source: "Audit",
    sourceUrl: "https://example.com/job",
    applyUrl: "https://example.com/job",
    attributionLabel: "Audit",
    termsProfile: "public-api",
    summary: "Endpoint engineering role.",
    tags: ["Endpoint"],
    matchReasons: ["Endpoint engineering"],
    tools: ["Intune"],
    platforms: ["Windows"],
    roleFamily: "Endpoint Engineering",
    seniority: "Mid",
    employmentType: "Full-time",
    ...overrides
  };
}

function assertEqual<T>(actual: T, expected: T, detail: string) {
  if (actual !== expected) {
    throw new Error(`${detail}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTruthy(value: unknown, detail: string) {
  if (!value) throw new Error(`missing ${detail}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, detail: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${detail}: values differ`);
  }
}

function assertSchema(document: Record<string, unknown>, pointer: string, value: unknown) {
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  const schema = {
    $ref: pointer,
    components: (document.components as Record<string, unknown>)
  };
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    throw new Error(`${pointer}: ${ajv.errorsText(validate.errors)}`);
  }
}

function assertLocalReferencesResolve(document: Record<string, unknown>) {
  const references = JSON.stringify(document).match(/#\/[A-Za-z0-9_~/{}/-]+/g) ?? [];

  for (const reference of new Set(references)) {
    assertTruthy(readPointer(document, reference), `OpenAPI reference ${reference}`);
  }
}

function readPointer(document: unknown, pointer: string) {
  return pointer
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>((value, key) => {
      if (!value || typeof value !== "object") return undefined;
      return (value as Record<string, unknown>)[key];
    }, document);
}
