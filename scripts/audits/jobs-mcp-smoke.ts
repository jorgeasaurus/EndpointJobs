import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = new URL(process.argv[2] ?? "http://localhost:3000");
const headers: Record<string, string> = JSON.parse(process.env.MCP_TEST_HEADERS ?? "{}");

for (const mode of ["legacy", "auto"] as const) {
  const client = new Client({ name: "endpointjobs-smoke", version: "1.0.0" }, {
    versionNegotiation: { mode }
  });
  const transport = new StreamableHTTPClientTransport(new URL("/api/mcp", base), { requestInit: { headers } });
  try {
    await client.connect(transport);
    assert.equal(transport.protocolVersion, mode === "legacy" ? "2025-11-25" : "2026-07-28",
      `${mode} client must exercise the advertised protocol, not silently downgrade`);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["get_filter_options", "get_job", "search_jobs"]);
    const options = await client.callTool({ name: "get_filter_options", arguments: {} });
    assert.ok(options.structuredContent && typeof options.structuredContent === "object" && "filters" in options.structuredContent);
    const search = await client.callTool({ name: "search_jobs", arguments: { limit: 2 } });
    assert.ok(!search.isError);
    const collection = search.structuredContent as {
      data: { id: string }[]; filters: unknown; meta: unknown;
    };
    const restResponse = await fetch(new URL("/api/jobs?limit=2", base), { headers });
    assert.equal(restResponse.status, 200);
    const rest = await restResponse.json();
    assert.deepEqual(collection.data.map((job) => job.id), rest.data.map((job: { id: string }) => job.id));
    assert.deepEqual(collection.filters, rest.filters);
    assert.deepEqual(collection.meta, rest.meta);
    assert.ok(collection.data.length, "Smoke test needs at least one active listing");
    const id = collection.data[0].id;
    const detail = await client.callTool({ name: "get_job", arguments: { id } });
    const restDetail = await fetch(new URL(`/api/jobs/${encodeURIComponent(id)}`, base), { headers });
    assert.equal(restDetail.status, 200);
    assert.deepEqual(detail.structuredContent, await restDetail.json());
    const missing = await client.callTool({ name: "get_job", arguments: { id: "mcp-smoke-missing-id" } });
    assert.equal(missing.isError, true);
    console.log(JSON.stringify({ base: base.origin, mode, protocol: transport.protocolVersion, server: client.getServerVersion(), tools: tools.length, apiParity: true }));
  } finally {
    await client.close();
  }
}
