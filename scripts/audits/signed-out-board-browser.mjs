import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3010";
const expectSignIn = process.env.EXPECT_SIGN_IN === "1";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {})
});

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${baseUrl}/board`, { waitUntil: "domcontentloaded" });

await expect(page.getByRole("link", { name: "Endpoint Jobs home" })).toBeVisible();
const search = page.locator('input[data-job-search="true"]');
await expect(search).toBeVisible();
await expect(page.locator("article.job-card").first()).toBeVisible();
const searchChip = page.locator(".active-filter-chip", { hasText: "Search: Intune" });
await search.fill("Intune");
try {
  await expect(searchChip).toBeVisible({ timeout: 2000 });
} catch {
  await search.fill("Intune");
  await expect(searchChip).toBeVisible();
}

const signIn = page.getByRole("button", { name: "Sign in" });
if (expectSignIn) {
  await expect(signIn).toBeVisible();
  await signIn.click();
  const dialog = page.getByRole("dialog", { name: "Sign in" });
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
} else {
  await expect(signIn).toHaveCount(0);
}

await page.getByRole("link", { name: "Privacy", exact: true }).click();
await expect(page).toHaveURL(/\/privacy$/);
await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();

if (expectSignIn) {
  await page.getByRole("button", { name: "Sign in" }).click();
  const privacyDialog = page.getByRole("dialog", { name: "Sign in" });
  await expect(privacyDialog).toBeVisible();
  await privacyDialog.getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(privacyDialog).toBeHidden();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
}
await expect(page.locator(".privacy-version")).toHaveText("Version 2026-10-24");
for (const heading of [
  "What we collect",
  "Why",
  "What we don't collect",
  "Processors",
  "Retention and control",
  "Signed-out visitors",
  "Contact",
  "Last updated"
]) {
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

const jobs = await fetch(new URL("/api/jobs?limit=1", baseUrl));
if (!jobs.ok) throw new Error(`/api/jobs returned ${jobs.status}`);
const body = await jobs.json();
if (!Array.isArray(body.data) || body.data.length === 0) {
  throw new Error("/api/jobs returned no listings");
}

await browser.close();
console.log(JSON.stringify({ baseUrl, expectSignIn, signedOutBoard: true, privacy: true, jobsApi: jobs.status }));
