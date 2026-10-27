import { expect, test } from "@playwright/test";

const preview = process.env.PHASE2_PREVIEW_URL;

test("[AUTH-01] sign-in dialog opens on the preview", async ({ page }) => {
  test.skip(!preview, "preview URL is not configured");
  const oauthUrls: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (/supabase\.co|accounts\.google\.com|github\.com\/login/.test(url)) {
      oauthUrls.push(url);
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto(preview!);
  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in or create an account" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect(dialog.getByText(/never sees that password/i)).toBeVisible();

  await dialog.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => oauthUrls.length).toBeGreaterThan(0);
  const target = new URL(oauthUrls[0]);
  const redirectTo = target.searchParams.get("redirect_to") ?? "";
  expect(redirectTo).toContain("/auth/callback");
  expect(decodeURIComponent(redirectTo)).toContain("next=");
  expect(redirectTo).not.toContain("evil.example");

  await page.goto(preview!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Privacy policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
