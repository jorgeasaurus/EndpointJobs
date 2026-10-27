import { expect, test } from "@playwright/test";

test.beforeEach(({ }, info) => {
  test.skip(info.project.name !== "desktop", "HTTP stories are not viewport-specific");
});

test("[HOME-05] legacy board URLs", async ({ request }) => {
  const keys = [
    "q", "location", "platforms", "tools", "metroAreas", "workplace", "sponsorship",
    "salary", "leadership", "minSalary", "seniority", "family", "freshness", "sort",
    "locations", "remote", "page"
  ];
  for (const key of keys) {
    const response = await request.get(`/?${key}=1`, { maxRedirects: 0 });
    expect(response.status(), key).toBe(308);
    expect(response.headers().location).toBe(`/board?${key}=1`);
  }
  const home = await request.get("/", { maxRedirects: 0 });
  expect(home.status()).toBe(200);
  const privacy = await request.get("/privacy?q=jamf", { maxRedirects: 0 });
  expect(privacy.status()).toBe(200);
});

test("[BOARD-01] board document", async ({ request }) => {
  const response = await request.get("/board");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain("<title>Job board");
  expect(html).toContain('rel="canonical" href="https://endpointjobs.dev/board"');
  expect(html).not.toMatch(/noindex/i);
});

test("[BOARD-05] board query cache", async ({ request }) => {
  const response = await request.get("/api/board?q=intune");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe(
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
  );
  const body = await response.json();
  expect(body.pageSize).toBe(20);
  expect(Array.isArray(body.jobs)).toBeTruthy();
});

test("[API-01] job collection", async ({ request }) => {
  const ok = await request.get("/api/jobs");
  expect(ok.status()).toBe(200);
  expect(ok.headers()["access-control-allow-origin"]).toBe("*");
  expect(ok.headers()["cache-control"]).toBe("public, s-maxage=300, stale-while-revalidate=3600");
  const body = await ok.json();
  expect(body.meta.page).toBe(1);
  expect(body.meta.limit).toBe(20);
  expect(Array.isArray(body.data)).toBeTruthy();
  expect(body.data.length).toBeLessThanOrEqual(20);

  const limited = await request.get("/api/jobs?limit=1");
  expect((await limited.json()).data).toHaveLength(1);

  const options = await request.fetch("/api/jobs", { method: "OPTIONS" });
  expect(options.status()).toBe(204);
  expect(options.headers()["access-control-allow-origin"]).toBe("*");

  for (const path of ["/api/jobs?limit=0", "/api/jobs?nope=1", "/api/jobs?q=a&q=b"]) {
    const bad = await request.get(path);
    expect(bad.status(), path).toBe(400);
    expect((await bad.json()).error.code).toBe("INVALID_QUERY");
    expect(bad.headers()["cache-control"]).toBe("no-store");
  }

  const long = await request.get(`/api/jobs?q=${"a".repeat(201)}`);
  expect(long.status()).toBe(400);
});

test("[API-02] one job", async ({ request }) => {
  const collection = await (await request.get("/api/jobs?limit=1")).json();
  const id = collection.data[0].id as string;
  const ok = await request.get(`/api/jobs/${encodeURIComponent(id)}`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["cache-control"]).toContain("s-maxage=300");
  const detail = await ok.json();
  expect(detail.data.id).toBe(id);
  expect(typeof detail.meta.updatedAt).toBe("string");

  const missing = await request.get("/api/jobs/phase2-missing-job");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["cache-control"]).toBe("no-store");
  expect(await missing.json()).toMatchObject({
    error: { code: "JOB_NOT_FOUND", message: "Job listing not found." }
  });

  const options = await request.fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: "OPTIONS" });
  expect(options.status()).toBe(204);
});

test("[API-04] openapi document", async ({ request }) => {
  const response = await request.get("/openapi.json");
  expect(response.ok()).toBeTruthy();
  const spec = await response.json();
  expect(spec.openapi).toBeTruthy();
  expect(spec.paths["/api/jobs"]).toBeTruthy();
  expect(spec.paths["/api/jobs/{id}"]).toBeTruthy();
});

test("[MCP-03] mcp http access", async ({ request }) => {
  const denied = await request.post("/api/mcp", {
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    data: {}
  });
  expect(denied.status()).toBe(403);
  expect(denied.headers()["cache-control"]).toContain("no-store");

  const allowedOrigin = await request.fetch("/api/mcp", {
    method: "OPTIONS",
    headers: {
      origin: "https://endpointjobs.dev",
      "access-control-request-method": "POST",
      "access-control-request-headers": "accept, content-type, mcp-protocol-version"
    }
  });
  expect(allowedOrigin.status()).toBe(204);
  expect(allowedOrigin.headers()["access-control-allow-methods"]).toContain("POST");
  expect(allowedOrigin.headers()["cache-control"]).toContain("no-store");

  const get = await request.get("/api/mcp");
  expect(get.status()).toBe(405);
  expect(get.headers()["cache-control"]).toContain("no-store");
});

test("[JOB-04] missing job", async ({ request }) => {
  const missing = await request.get("/jobs/phase2-not-a-job");
  expect(missing.status()).toBe(404);
  const html = await missing.text();
  expect(html).toContain("Job not found");
  expect(html.toLowerCase()).toContain("noindex");
});

test("[PAGE-02] directory bounds", async ({ request }) => {
  const first = await request.get("/jobs");
  expect(first.ok()).toBeTruthy();
  const html = await first.text();
  expect(html).toContain("<h1>All endpoint jobs</h1>");
  expect(html).toContain('rel="canonical" href="https://endpointjobs.dev/jobs"');
  const links = [...html.matchAll(/href="\/jobs\/[^"?#]+"/g)];
  expect(links.length).toBeGreaterThan(0);
  expect(links.length).toBeLessThanOrEqual(50);

  const zero = await request.get("/jobs?page=0");
  expect(zero.ok()).toBeTruthy();
  const fractional = await request.get("/jobs?page=1.5");
  expect(fractional.ok()).toBeTruthy();
  const past = await request.get("/jobs?page=99999");
  expect(past.status()).toBe(404);
});

test("[SEO-01] root metadata", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain('lang="en"');
  expect(html).toContain("https://endpointjobs.dev");
  expect(html).toContain("/og-image.png");
  expect(html).toMatch(/theme-color" content="#000000"|name="theme-color" content="#000"/);
});

test("[SEO-03] robots and sitemap", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("User-Agent: *");
  expect(robots).toContain("User-Agent: Googlebot");
  expect(robots).toContain("Sitemap: https://endpointjobs.dev/sitemap.xml");
  expect(robots).toContain("Host: https://endpointjobs.dev");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["https://endpointjobs.dev", "https://endpointjobs.dev/board", "/api-docs", "/mcp", "/privacy"]) {
    expect(sitemap).toContain(path.startsWith("http") ? path : `https://endpointjobs.dev${path}`);
  }
  expect(sitemap).toContain("https://endpointjobs.dev/jobs/");
  expect(sitemap).toContain("https://endpointjobs.dev/jamf");
});

test("[AUTH-02] callback without a session", async ({ request }) => {
  const response = await request.get("/auth/callback?next=https://evil.example", { maxRedirects: 0 });
  expect([307, 302, 303]).toContain(response.status());
  const location = response.headers().location ?? "";
  expect(new URL(location, "http://127.0.0.1:3000").pathname).toBe("/");
});

test("[AUTH-04] sign-out ignores next", async ({ request }) => {
  const response = await request.post("/auth/sign-out?next=https://evil.example", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(new URL(response.headers().location ?? "", "http://127.0.0.1:3000").pathname).toBe("/");
});

test("[AUTH-06] cross-site sign-out", async ({ request }) => {
  const response = await request.post("/auth/sign-out", {
    maxRedirects: 0,
    headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" }
  });
  expect(response.status()).toBe(403);
  expect(await response.text()).toContain("Sign out must come from this site");
});

test("[AUTH-08] no sign-in control without Supabase", async ({ page }) => {
  await page.goto("/board");
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Endpoint Jobs" })).toBeVisible();
});

test("[FILT-16] unknown tool slug", async ({ request }) => {
  const known = await request.get("/jamf");
  expect(known.ok()).toBeTruthy();
  const html = await known.text();
  expect(html).toContain("<title>");
  expect(html.toLowerCase()).toContain("jamf");
  const unknown = await request.get("/not-a-real-tool-slug");
  expect(unknown.status()).toBe(404);
});

test("[FRESH-01] updated timestamp on the page", async ({ page }) => {
  await page.goto("/board");
  const pill = page.locator(".refresh-pill");
  await expect(pill).toContainText(/UTC|Pending refresh/);
});
