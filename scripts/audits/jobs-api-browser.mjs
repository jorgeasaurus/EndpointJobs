import { expect } from "@playwright/test";

export async function auditJobsApiBrowser({ baseUrl, browser, desktopViewport, newPage, run }) {
  await run("FEAT-075", "Public jobs API serves validated collection and item responses", async () => {
    const page = await newPage(browser, desktopViewport);
    const collection = await page.request.get(
      `${baseUrl}/api/jobs?platforms=Windows&page=1&limit=2`
    );
    expect(collection.status()).toBe(200);
    expect(collection.headers()["access-control-allow-origin"]).toBe("*");
    expect(collection.headers()["cache-control"]).toContain("s-maxage=300");
    const body = await collection.json();
    expect(body.data).toHaveLength(2);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(2);
    expect(body.meta.total).toBeGreaterThanOrEqual(2);
    expect(body.data.every((job) => job.platforms.includes("Windows"))).toBeTruthy();

    const item = await page.request.get(`${baseUrl}/api/jobs/${body.data[0].id}`);
    expect(item.status()).toBe(200);
    expect((await item.json()).data.id).toBe(body.data[0].id);

    const invalid = await page.request.get(`${baseUrl}/api/jobs?limit=101&wat=1`);
    expect(invalid.status()).toBe(400);
    expect(invalid.headers()["cache-control"]).toBe("no-store");
    expect((await invalid.json()).error.code).toBe("INVALID_QUERY");

    const missing = await page.request.get(`${baseUrl}/api/jobs/not-a-real-job`);
    expect(missing.status()).toBe(404);
    expect((await missing.json()).error.code).toBe("JOB_NOT_FOUND");

    const preflight = await page.request.fetch(`${baseUrl}/api/jobs`, {
      method: "OPTIONS"
    });
    expect(preflight.status()).toBe(204);
    expect(preflight.headers()["access-control-allow-origin"]).toBe("*");
    await page.close();
  });
}
