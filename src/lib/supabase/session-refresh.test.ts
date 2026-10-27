import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AUTH_LOOKUP_TIMEOUT_MS,
  AUTH_TOKEN_TIMEOUT_MS,
  authFetchSignal,
  authFetchTimeoutMs,
  skipsSessionRefresh
} from "./session-refresh";

test("session refresh skips the jobs API, MCP, and static assets", () => {
  for (const pathname of [
    "/api/jobs",
    "/api/jobs/adzuna-1",
    "/api/board",
    "/api/board/map",
    "/api/board/listings/example",
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
  for (const pathname of ["/", "/board", "/jobs", "/jobs/example", "/privacy", "/auth/callback", "/api-docs"]) {
    assert.equal(skipsSessionRefresh(pathname), false, pathname);
  }
});

test("proxy matcher excludes the jobs API, MCP, and static files", () => {
  const source = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");
  assert.match(source, /api\/jobs/);
  assert.match(source, /api\/board/);
  assert.match(source, /api\/mcp/);
  assert.match(source, /mcp/);
  assert.match(source, /_next\/static/);
  assert.match(source, /export async function proxy/);
});

test("a non-token request with a session cookie still gets an abort signal", () => {
  const timeouts: number[] = [];
  const signal = authFetchSignal(
    "https://project.supabase.co/auth/v1/user",
    { headers: { cookie: "sb-project-auth-token=session" } },
    (ms) => {
      timeouts.push(ms);
      return AbortSignal.timeout(ms);
    }
  );
  assert.deepEqual(timeouts, [AUTH_LOOKUP_TIMEOUT_MS]);
  assert.equal(signal.aborted, false);

  const caller = AbortSignal.abort();
  const combined = authFetchSignal("https://project.supabase.co/auth/v1/user", { signal: caller }, (ms) => {
    timeouts.push(ms);
    return AbortSignal.timeout(ms);
  });
  assert.equal(combined.aborted, true);
});

test("the token endpoint still aborts, including when a session cookie is present", () => {
  const timeouts: number[] = [];
  const signal = authFetchSignal(
    "http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token",
    { headers: { cookie: "sb-project-auth-token=session" } },
    (ms) => {
      timeouts.push(ms);
      return new AbortController().signal;
    }
  );
  assert.deepEqual(timeouts, [AUTH_TOKEN_TIMEOUT_MS]);
  assert.equal(signal.aborted, false);
});

test("only the token endpoint gets the longer auth deadline", () => {
  const token = "https://project.supabase.co/auth/v1/token?grant_type=refresh_token";
  assert.equal(authFetchTimeoutMs(token), AUTH_TOKEN_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs(new URL(token)), AUTH_TOKEN_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs(new Request(token)), AUTH_TOKEN_TIMEOUT_MS);
  assert.equal(
    authFetchTimeoutMs("http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token"),
    AUTH_TOKEN_TIMEOUT_MS
  );
  assert.equal(authFetchTimeoutMs("https://project.supabase.co/auth/v1/user"), AUTH_LOOKUP_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs("https://project.supabase.co/auth/v1/user?next=/auth/v1/token"), AUTH_LOOKUP_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs("https://project.supabase.co/auth/v1/logout?scope=local"), AUTH_LOOKUP_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs("https://project.supabase.co/auth/v1/token/extra"), AUTH_LOOKUP_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs("https://project.supabase.co/auth/v1/token/"), AUTH_LOOKUP_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs("https://project.supabase.co/auth/v1/token.evil"), AUTH_LOOKUP_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs("/auth/v1/token"), AUTH_LOOKUP_TIMEOUT_MS);
  assert.equal(authFetchTimeoutMs("not a url"), AUTH_LOOKUP_TIMEOUT_MS);
});

test("a failed session refresh keeps cookies that were already rotated", () => {
  const source = readFileSync(new URL("./proxy.ts", import.meta.url), "utf8");
  assert.match(source, /return supabaseResponse;/);
  assert.doesNotMatch(source, /catch\s*\{[^}]*NextResponse\.next/);
  assert.match(source, /fetchWithAuthDeadline/);
  assert.doesNotMatch(source, /preserveSessionRefresh/);
});
