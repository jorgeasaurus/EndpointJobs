import { expect } from "@playwright/test";
import { sponsorshipLabels, sponsorshipStatuses } from "../../src/lib/visa-sponsorship.ts";

export async function auditSponsorshipBrowser({
  baseUrl, browser, desktopViewport, mobileViewport, newPage, run
}) {
  for (const viewport of [desktopViewport, mobileViewport]) {
    await run(`SPONSORSHIP-${viewport.width}`, "Sponsorship filters match the API, preserve URLs, and expose evidence", async () => {
      const page = await newPage(browser, viewport);
      await page.goto(`${baseUrl}/?sponsorship=unavailable&utm_source=audit`);
      const select = page.getByRole("combobox", { name: "Visa sponsorship", exact: true });
      await expect(select).toHaveValue("unavailable");

      for (const status of sponsorshipStatuses) {
        await select.selectOption(status);
        const response = await page.request.get(`${baseUrl}/api/jobs?sponsorship=${status}&limit=20`);
        expect(response.ok()).toBeTruthy();
        const { data } = await response.json();
        expect(data.every((job) => (job.visaSponsorship?.status ?? "not-stated") === status)).toBeTruthy();
        const cards = page.getByRole("article");
        await expect(cards).toHaveCount(data.length);
        for (const [index, job] of data.entries()) {
          await expect(cards.nth(index).getByRole("heading", { name: job.title, exact: true })).toBeVisible();
        }
        if (data.length && status !== "not-stated") {
          const firstCard = cards.first();
          await firstCard.getByText(`Visa sponsorship: ${sponsorshipLabels[status]}`, { exact: true }).click();
          const evidence = firstCard.getByRole("blockquote");
          await expect(evidence).toHaveText(data[0].visaSponsorship.evidence);
          await expect(evidence).toBeVisible();
          await expect(firstCard.getByRole("link", { name: "Read original listing" })).toHaveAttribute("href", data[0].visaSponsorship.sourceUrl);
          const detailResponse = await page.request.get(`${baseUrl}/jobs/${data[0].id}`);
          expect(detailResponse.ok()).toBeTruthy();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      }

      await select.selectOption("available");
      await expect(page).toHaveURL(/sponsorship=available/);
      await page.reload();
      await expect(select).toHaveValue("available");
      await page.getByRole("button", { name: "Remove filter: Visa: Available", exact: true }).click();
      await expect(select).toHaveValue("Any");
      expect(new URL(page.url()).searchParams.has("sponsorship")).toBeFalsy();
      expect(new URL(page.url()).searchParams.get("utm_source")).toBe("audit");
      await page.close();
    });
  }
}
