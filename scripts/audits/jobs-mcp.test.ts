import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "mcp-handler";
import { queryJobs } from "../../src/lib/jobs-api";
import { jobsApiQueryContract } from "../../src/lib/jobs-api-contract";
import { jobsMcpSearchSchema, registerJobsMcpTools } from "../../src/lib/jobs-mcp";
import type { Job, JobsFeed } from "../../src/types/job";

const now = new Date("2026-10-04T12:00:00Z");
function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id, title: "Endpoint Engineer", company: id, location: "London, UK", workplace: "Remote",
    postedAt: "2026-10-03T12:00:00Z", fetchedAt: "2026-10-04T00:00:00Z",
    staleAfter: "2026-11-01T00:00:00Z", source: "Fixture",
    sourceUrl: `https://example.com/jobs/${id}`, applyUrl: `https://example.com/apply/${id}`,
    attributionLabel: "Fixture attribution", termsProfile: "public-api",
    summary: "Manage Intune endpoints.", description: "Full description, reserved for detail lookup.",
    tags: ["Endpoint"], matchReasons: ["Intune"], tools: ["Intune"], platforms: ["Windows"],
    roleFamily: "Endpoint Engineering", seniority: "Mid", employmentType: "Full-time",
    salary: { min: 100000, max: 160000, currency: "USD", label: "$100k–160k" },
    ...overrides
  };
}
const feed: JobsFeed = {
  updatedAt: "2026-10-04T00:00:00Z", source: { name: "Fixture", url: "https://example.com" },
  jobs: [job("alpha"), job("beta", { visaSponsorship: { status: "available", evidence: "Sponsorship available", sourceUrl: "https://example.com/jobs/beta" } }),
    job("euro", { salary: { max: 200000, currency: "EUR", label: "EUR 200k" } }),
    job("expired", { staleAfter: "2026-10-01T00:00:00Z" })]
};

async function withClient(run: (client: Client) => Promise<void>) {
  const handler = createMcpHandler((server) => registerJobsMcpTools(server, feed, () => now));
  const client = new Client({ name: "jobs-mcp-fixture-tests", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://example.com/api/mcp"), {
    fetch: async (input, init) => handler(new Request(input, init))
  });
  try {
    await client.connect(transport);
    await run(client);
  } finally {
    await client.close();
  }
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const response = await client.callTool({ name, arguments: args });
  assert.equal(response.isError, undefined);
  assert.ok(response.structuredContent);
  const text = response.content.find((item) => item.type === "text");
  assert.ok(text && text.type === "text");
  assert.deepEqual(JSON.parse(text.text), JSON.parse(JSON.stringify(response.structuredContent)));
  return response.structuredContent as Record<string, unknown>;
}

test("MCP discovers three read-only tools and schemas stay aligned with the query contract", async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["get_filter_options", "get_job", "search_jobs"]);
    for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true);
    const schema = tools.find((tool) => tool.name === "search_jobs")!.inputSchema;
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(Object.keys(schema.properties ?? {}).sort(), Object.keys(jobsApiQueryContract).sort());
    for (const [key, definition] of Object.entries(jobsApiQueryContract)) {
      const property = schema.properties![key] as Record<string, unknown>;
      if (definition.kind === "multi") {
        assert.deepEqual((property.items as Record<string, unknown>).enum, definition.values);
      } else if (definition.kind === "enum") {
        assert.deepEqual(property.enum ?? [property.const], definition.values);
      } else if (definition.kind === "integer") {
        assert.equal(property.minimum, definition.minimum);
        assert.equal(property.default, definition.default);
        if ("maximum" in definition) assert.equal(property.maximum, definition.maximum);
      }
    }
    const options = await call(client, "get_filter_options");
    assert.deepEqual(options.filters, schema.properties);
    assert.equal((options.filters as Record<string, { maximum?: number }>).page.maximum, Number.MAX_SAFE_INTEGER);
    assert.deepEqual(options.meta, { updatedAt: feed.updatedAt });
  });
});

test("MCP search preserves REST IDs, filters, pagination, salary ceiling and sponsorship semantics", async () => {
  await withClient(async (client) => {
    const cases = [
      { input: {}, query: "" },
      { input: { q: "  Endpoint  ", tools: ["Intune"], platforms: ["Windows"], metroAreas: ["London, UK"], sort: "company", page: 2, limit: 1 }, query: "q=Endpoint&tools=Intune&platforms=Windows&metroAreas=London%2C+UK&sort=company&page=2&limit=1" },
      { input: { minSalary: "150000", sponsorship: "not-stated" }, query: "minSalary=150000&sponsorship=not-stated" },
      { input: { freshness: "7", salary: "1", workplace: "Remote" }, query: "freshness=7&salary=1&workplace=Remote" }
    ];
    for (const { input, query } of cases) {
      const actual = await call(client, "search_jobs", input);
      const expected = queryJobs(feed, new URLSearchParams(query), now);
      assert.ok(expected.ok);
      assert.deepEqual((actual.data as Job[]).map((item) => item.id), expected.body.data.map((item) => item.id));
      assert.deepEqual(actual.filters, expected.body.filters);
      assert.deepEqual(actual.meta, expected.body.meta);
    }
    const salary = await call(client, "search_jobs", { minSalary: "150000", sponsorship: "not-stated" });
    assert.deepEqual((salary.data as Job[]).map((item) => item.id), ["alpha"]);
  });
});

test("MCP search summaries retain attribution and links while details retain full descriptions", async () => {
  await withClient(async (client) => {
    const search = await call(client, "search_jobs");
    const summaries = search.data as Job[];
    assert.equal(summaries.length, 3);
    const summary = summaries.find((item) => item.id === "alpha")!;
    assert.equal("description" in summary, false);
    assert.equal(summary.sourceUrl, feed.jobs[0].sourceUrl);
    assert.equal(summary.applyUrl, feed.jobs[0].applyUrl);
    assert.equal(summary.attributionLabel, feed.jobs[0].attributionLabel);
    const detail = await call(client, "get_job", { id: "alpha" });
    assert.deepEqual(detail, { data: feed.jobs[0], meta: { updatedAt: feed.updatedAt } });
    const empty = await call(client, "search_jobs", { q: "nonexistent-role" });
    assert.deepEqual(empty.data, []);
    assert.equal((empty.meta as { total: number }).total, 0);
    for (const id of ["expired", "missing"]) {
      const response = await client.callTool({ name: "get_job", arguments: { id } });
      assert.equal(response.isError, true);
      assert.equal(((response.structuredContent as { error: { code: string } }).error).code, "JOB_NOT_FOUND");
    }
  });
});

test("MCP rejects invalid filter values, unknown fields and pagination bypasses", async () => {
  await withClient(async (client) => {
    for (const args of [{ unknown: true }, { limit: 101 }, { limit: 0 }, { page: 1.5 },
      { page: Number.MAX_SAFE_INTEGER + 1 }, { limit: "100" }, { sponsorship: "yes" },
      { tools: ["unsupported"] }, { tools: [] }, { q: "   " }, { q: "x".repeat(201) },
      { leadership: "0" }, { minSalary: "150001" }]) {
      assert.equal(jobsMcpSearchSchema.safeParse(args).success, false);
      const response = await client.callTool({ name: "search_jobs", arguments: args });
      assert.equal(response.isError, true, JSON.stringify(args));
      assert.ok(response.content.some((item) => item.type === "text" && item.text.length > 0));
    }
  });
});
