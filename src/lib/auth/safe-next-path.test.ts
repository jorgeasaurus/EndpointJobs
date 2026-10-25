import assert from "node:assert/strict";
import test from "node:test";

import { buildOAuthRedirectTo, safeNextPath, safeRedirectUrl } from "./safe-next-path";

test("same-origin relative paths are preserved", () => {
  assert.equal(safeNextPath("/"), "/");
  assert.equal(safeNextPath("/jobs"), "/jobs");
  assert.equal(safeNextPath("/jobs?page=2"), "/jobs?page=2");
  assert.equal(safeNextPath("/jobs?q=a&b=c"), "/jobs?q=a&b=c");
  assert.equal(safeNextPath("/jobs?q=hello%20world"), "/jobs?q=hello%20world");
  assert.equal(safeNextPath("/jobs/abc-123"), "/jobs/abc-123");
  assert.equal(safeNextPath("/privacy"), "/privacy");
  assert.equal(safeNextPath("/jobs#map"), "/jobs#map");
  assert.equal(safeNextPath("  /mcp?tab=agent  "), "/mcp?tab=agent");
  assert.equal(safeNextPath("/jobs?next=https://evil.example/phish"), "/jobs?next=https://evil.example/phish");
});

test("missing values fall back to the home path", () => {
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath(undefined), "/");
  assert.equal(safeNextPath(""), "/");
  assert.equal(safeNextPath("   "), "/");
});

test("absolute URLs, schemes, and protocol-relative paths are rejected", () => {
  for (const value of [
    "https://evil.example",
    "http://evil.example/jobs",
    "https://endpointjobs.dev/jobs",
    "HTTP://evil.example",
    "//evil.example",
    "///evil.example",
    "//evil.example/path",
    "javascript:alert(1)",
    "data:text/html,hi",
    "mailto:person@example.com",
    "javascript://endpointjobs.dev/%0aalert(1)",
    "/.//evil.example",
    "/foo/..//evil.example",
    "/jobs/..//evil.example"
  ]) {
    assert.equal(safeNextPath(value), "/", value);
  }
});

test("backslashes and encoded or nested open-redirect variants are rejected", () => {
  for (const value of [
    "\\\\evil.example",
    "/\\evil.example",
    "/\\\\evil.example",
    "/\\@evil.example",
    "/%2F%2Fevil.example",
    "/%2f%2fevil.example",
    "%2F%2Fevil.example",
    "/%5Cevil.example",
    "/%5c%5cevil.example",
    "https:%2F%2Fevil.example",
    "/%252F%252Fevil.example",
    "/%2e%2e//evil.example",
    "/%2e%2f%2fevil.example",
    "/jobs%5C..%5Cevil.example",
    "/%09/evil.example",
    "/%0a/evil.example",
    "/%0d%0aLocation:%20https://evil.example",
    "/jobs%00",
    "/%00/jobs",
    "/%",
    "/%ZZ",
    "/\uFF0Fevil.example",
    "/\\uFF0Fevil.example",
    "\n//evil.example",
    "\t//evil.example"
  ]) {
    assert.equal(safeNextPath(value), "/", value);
  }
});

test("redirect URL stays on the request origin", () => {
  const origin = "https://endpointjobs.dev";
  assert.equal(safeRedirectUrl(origin, "/jobs?page=2").href, "https://endpointjobs.dev/jobs?page=2");
  assert.equal(safeRedirectUrl(origin, "https://evil.example").href, "https://endpointjobs.dev/");
  assert.equal(safeRedirectUrl(origin, "//evil.example").href, "https://endpointjobs.dev/");
  assert.equal(safeRedirectUrl(origin, "/%2f%2fevil.example").href, "https://endpointjobs.dev/");
});

test("OAuth redirectTo carries the current path as a safe next parameter", () => {
  const redirectTo = buildOAuthRedirectTo("https://endpointjobs.dev", "/jobs?q=intune");
  const url = new URL(redirectTo);
  assert.equal(url.origin, "https://endpointjobs.dev");
  assert.equal(url.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("next"), "/jobs?q=intune");

  const rejected = new URL(buildOAuthRedirectTo("http://localhost:3000", "//evil.example"));
  assert.equal(rejected.searchParams.get("next"), "/");
});

test("encoded filters survive the OAuth next round trip", () => {
  const origin = "https://endpointjobs.dev";
  const cases = [
    { path: "/?q=C%2B%2B", query: "C++" },
    { path: "/?q=R%26D", query: "R&D" },
    { path: "/?q=100%25", query: "100%" }
  ];
  for (const { path, query } of cases) {
    assert.equal(safeNextPath(path), path, path);
    const next = new URL(buildOAuthRedirectTo(origin, path)).searchParams.get("next");
    assert.equal(next, path, path);
    assert.equal(safeNextPath(next), path, path);
    const destination = safeRedirectUrl(origin, next);
    assert.equal(destination.href, `${origin}${path}`, path);
    assert.equal(destination.searchParams.get("q"), query, path);
    assert.deepEqual([...destination.searchParams.keys()], ["q"], path);
  }
});
