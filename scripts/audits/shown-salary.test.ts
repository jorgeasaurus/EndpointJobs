import assert from "node:assert/strict";
import test from "node:test";

import { initialFilterState } from "../../src/components/job-board/filter-model";
import { queryBoardPage, selectLandingPreview } from "../../src/lib/board-page";
import { formatRelativePosted, formatRelativeUpdated } from "../../src/lib/jobs";
import { formatRolePlace } from "../../src/lib/role-place";
import { presentSalary } from "../../src/lib/job-trust";
import { formatShownSalary, hasShownSalary } from "../../src/lib/shown-salary";
import { makeJob } from "./shared";

test("shown salaries use the posting currency and stay in sync with the salary stat", () => {
  const listing = (id: string, location: string, salary: NonNullable<ReturnType<typeof makeJob>["salary"]>) => makeJob({
    id,
    title: id,
    company: id,
    location,
    sourceUrl: `https://example.com/${id}`,
    applyUrl: `https://example.com/${id}/apply`,
    salary
  });
  const usd = listing("usd-range", "Seattle, WA", {
    min: 120000, max: 150000, currency: "USD", currencySource: "source", label: "$120k-$150k"
  });
  const euro = listing("eur-range", "Berlin, Germany", {
    min: 60000, max: 75000, currency: "EUR", currencySource: "source", label: "€60k-€75k"
  });
  const estimated = listing("estimated", "Austin, TX", {
    min: 76000, max: 76000, currency: "USD", currencySource: "default", label: "$76k-$76k"
  });
  const hourly = listing("hourly", "Wellington, OH, us", {
    min: 55, max: 70, currency: "USD", currencySource: "source", label: "$55-$70/hr"
  });
  const converted = listing("converted", "Madrid, ES", {
    min: 90000, max: 130000, currency: "USD", currencySource: "default", label: "$90k-$130k"
  });
  const mismatched = listing("la-canada", "La Canada, Los Angeles County", {
    min: 120000, max: 120000, currency: "USD", currencySource: "default", label: "$120k-$120k"
  });
  const unlabeledPeriod = listing("no-period", "Empoli, Provincia di Firenze", {
    min: 35, max: 40, currency: "EUR", currencySource: "default", label: "€35-€40"
  });
  const jobs = [usd, euro, estimated, hourly, converted, mismatched, unlabeledPeriod];
  const page = queryBoardPage({
    updatedAt: "2026-10-26T11:00:00.000Z",
    source: { name: "Audit", url: "https://example.com/audit" },
    jobs
  }, initialFilterState, 1);

  assert.equal(formatShownSalary(usd), "$120k\u2013$150k");
  assert.equal(formatShownSalary(euro), "€60k\u2013€75k EUR");
  assert.equal(formatShownSalary(estimated), undefined);
  assert.equal(hasShownSalary(estimated), false);
  assert.equal(formatShownSalary(hourly), "$55\u2013$70/hr");
  assert.equal(formatShownSalary(converted), undefined);
  assert.equal(presentSalary(converted)?.currency, "EUR");
  assert.equal(formatShownSalary(mismatched), undefined);
  assert.equal(formatShownSalary(unlabeledPeriod), undefined);
  for (const job of jobs) {
    const shown = formatShownSalary(job);
    if (shown) assert.equal(shown.includes("est."), false);
  }
  assert.equal(page.metrics.salaryJobsCount, jobs.filter(hasShownSalary).length);
  assert.deepEqual(selectLandingPreview(jobs, initialFilterState).map((job) => job.id), [
    "usd-range",
    "eur-range",
    "hourly"
  ]);
});

test("role places keep the city and country without inventing a country", () => {
  assert.equal(formatRolePlace("Wellington, OH, us"), "Wellington, United States");
  assert.equal(formatRolePlace("Berlin, Germany"), "Berlin, Germany");
  assert.equal(formatRolePlace("Remote"), undefined);
  assert.equal(formatRolePlace("La Canada, Los Angeles County"), "La Canada, United States");
  assert.equal(formatRolePlace("Woodside, Houston"), "Woodside, Houston");
});

test("feed freshness reads as a relative time", () => {
  const now = new Date("2026-10-26T15:10:00.000Z");
  assert.equal(formatRelativeUpdated("2026-10-26T11:10:00.000Z", now), "Updated 4h ago");
  assert.equal(formatRelativePosted(makeJob({
    postedAt: "2026-10-24T15:10:00.000Z",
    fetchedAt: "2026-10-26T11:10:00.000Z"
  }), now), "2d ago");
});
