import { expect, test } from "@playwright/test";

test("[ACCT-04] the account page exists for signed-out visitors", async ({ page }) => {
  const response = await page.goto("/account");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
});

test("[PRIV-01] the privacy policy links to the account page", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: "account page" })).toHaveAttribute("href", "/account");
});
