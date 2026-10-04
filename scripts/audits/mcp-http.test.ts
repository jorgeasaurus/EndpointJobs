import assert from "node:assert/strict";
import test from "node:test";
import { withMcpHttp } from "../../src/lib/mcp-http";

const origin = "https://endpointjobs.dev";
const handler = withMcpHttp(async () => Response.json({ ok: true }), [origin]);

test("MCP permits native clients and explicit browser origins without caching", async () => {
  const cases: Record<string, string>[] = [{}, { Origin: origin }];
  for (const headers of cases) {
    const response = await handler(new Request(`${origin}/api/mcp`, { method: "POST", headers }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("vary"), "Origin");
    assert.equal(response.headers.get("access-control-allow-origin"), "Origin" in headers ? origin : null);
  }
});

test("MCP rejects unapproved and opaque origins before invoking tools", async () => {
  const guarded = withMcpHttp(async () => { throw new Error("Must not run"); }, [origin]);
  for (const value of ["https://evil.example", "null", ""]) {
    const response = await guarded(new Request(`${origin}/api/mcp`, { method: "POST", headers: { Origin: value } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  }
});

test("MCP browser preflight permits current and legacy protocol headers", async () => {
  const response = await handler(new Request(`${origin}/api/mcp`, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Headers": "Content-Type, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Param-Id" }
  }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /mcp-param-id/);
  const rejected = await handler(new Request(`${origin}/api/mcp`, {
    method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Headers": "X-Unrelated-Header" }
  }));
  assert.equal(rejected.status, 403);
});

test("stateless MCP rejects session methods and other unsupported methods", async () => {
  for (const method of ["GET", "DELETE", "PUT", "PATCH"]) {
    const response = await handler(new Request(`${origin}/api/mcp`, { method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST, OPTIONS");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
