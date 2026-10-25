import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { skipsSessionRefresh } from "./session-refresh";

test("session refresh skips the jobs API, MCP, and static assets", () => {
  for (const pathname of [
    "/api/jobs",
    "/api/jobs/adzuna-1",
    "/api/mcp",
    "/mcp",
    "/mcp/guide",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
    "/og-image.png",
    "/maplibre/worker.mjs",
    "/openapi.json"
  ]) {
    assert.equal(skipsSessionRefresh(pathname), true, pathname);
  }
});

test("session refresh still runs for the board and auth callback", () => {
  for (const pathname of ["/", "/jobs", "/jobs/example", "/privacy", "/auth/callback", "/api-docs"]) {
    assert.equal(skipsSessionRefresh(pathname), false, pathname);
  }
});

test("proxy matcher excludes the jobs API, MCP, and static files", () => {
  const source = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.match(source, /api\/jobs/);
  assert.match(source, /api\/mcp/);
  assert.match(source, /mcp/);
  assert.match(source, /_next\/static/);
  assert.match(source, /export async function proxy/);
});
