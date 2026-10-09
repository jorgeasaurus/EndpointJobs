import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:3137";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ timezoneId: "America/Los_Angeles", permissions: ["clipboard-read", "clipboard-write"], extraHTTPHeaders: JSON.parse(process.env.MCP_TEST_HEADERS ?? "{}") });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/mcp`);
    const human = page.getByRole("button", { name: "Human", exact: true });
    const agent = page.getByRole("button", { name: "Agent", exact: true });
    assert.equal(await human.getAttribute("aria-pressed"), "true");
    await page.getByRole("heading", { name: "Connect in three steps." }).waitFor();
    await page.getByRole("button", { name: "Copy MCP server URL", exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "https://endpointjobs.dev/api/mcp");
    await agent.focus();
    await page.keyboard.press("Enter");
    assert.equal(await agent.getAttribute("aria-pressed"), "true");
    assert.equal(await human.getAttribute("aria-pressed"), "false");
    await page.getByRole("heading", { name: "Ready for your agent." }).waitFor();
    await page.getByRole("button", { name: "Copy Agent instructions", exact: true }).click();
    const instructions = await page.evaluate(() => navigator.clipboard.readText());
    for (const value of ["https://endpointjobs.dev/api/mcp", "search_jobs", "get_job", "get_filter_options", "not-stated", "untrusted"]) {
      assert.ok(instructions.includes(value), `Missing ${value}`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Agent overflow at ${width}`);
    await page.screenshot({ path: `/tmp/endpointjobs-mcp-agent-${width}.png`, fullPage: true });
    await human.focus();
    await page.keyboard.press("Space");
    await page.getByRole("heading", { name: "Connect in three steps." }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Human overflow at ${width}`);
    await page.screenshot({ path: `/tmp/endpointjobs-mcp-human-${width}.png`, fullPage: true });
  }
  await page.goto(`${base}/api-docs`);
  await page.getByRole("link", { name: "MCP setup guide", exact: true }).click();
  await page.waitForURL(`${base}/mcp`);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://endpointjobs.dev/mcp");
  await page.goto(base);
  await page.getByRole("link", { name: "MCP guide", exact: true }).click();
  await page.waitForURL(`${base}/mcp`);
  assert.deepEqual(errors, []);
  console.log("MCP guide passed: Human/Agent toggle, keyboard, clipboard, navigation, canonical, no page errors or overflow at 1440/390/320px.");
} finally {
  await browser.close();
}
