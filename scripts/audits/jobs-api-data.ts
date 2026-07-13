import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";

import {
  createJobResponse,
  createJobsApiError,
  findActiveJob,
  queryJobs
} from "../../src/lib/jobs-api";
import { getJobsApiOpenApiParameters } from "../../src/lib/jobs-api-contract";
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
    assertEqual(findActiveJob(feed, "one", now)?.id, "one", "active job lookup");
    assertEqual(findActiveJob(feed, "stale", now), undefined, "stale job lookup excluded");

    const specification = JSON.parse(
      await readFile("public/openapi.json", "utf8")
    ) as Record<string, unknown>;
    assertEqual(specification.openapi, "3.1.0", "OpenAPI version");
    assertTruthy(readPointer(specification, "#/paths/~1api~1jobs/get"), "collection path");
    assertTruthy(readPointer(specification, "#/paths/~1api~1jobs~1{id}/get"), "item path");
    assertLocalReferencesResolve(specification);
    assertDeepEqual(
      readPointer(specification, "#/components/parameters"),
      getJobsApiOpenApiParameters(),
      "OpenAPI query parameters match canonical contract"
    );
    assertSchema(specification, "#/components/schemas/JobCollection", result.body);
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
