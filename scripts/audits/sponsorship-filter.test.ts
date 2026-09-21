import assert from "node:assert/strict";
import test from "node:test";
import type { Job } from "../../src/types/job";
import { filterJobs } from "../../src/lib/job-filters";
import { filterReducer, initialFilterState } from "../../src/components/job-board/filter-model";
import { filterStateFromSearchParams, mergeFilterStateIntoSearchParams } from "../../src/components/job-board/filter-url";
import { getActiveFilterItems } from "../../src/components/job-board/active-filters";
import { sponsorshipStatuses } from "../../src/lib/visa-sponsorship";
import { toEndpointJob } from "../job-refresh/shared";

const base = toEndpointJob({
  id: "fixture", title: "Endpoint Engineer", company: "Example", location: "Remote",
  postedAt: "2026-09-20", fetchedAt: new Date("2026-09-20"), source: "Test",
  sourceUrl: "https://example.com/job", attributionLabel: "Test", termsProfile: "seed",
  description: "Manage Intune endpoints."
})!;

test("sponsorship filters distinguish absent metadata, compose with location, and reset", () => {
  const jobs: Job[] = sponsorshipStatuses.map((status) => ({ ...base, id: status, visaSponsorship: status === "not-stated" ? { status } : { status, evidence: `${status} sponsorship statement.`, sourceUrl: base.sourceUrl } }));
  jobs.push({ ...base, id: "legacy", visaSponsorship: undefined });
  for (const status of sponsorshipStatuses) {
    const filters = filterReducer(initialFilterState, { type: "setSponsorship", value: status });
    assert.deepEqual(filterJobs(jobs, filters).map((job) => job.id), status === "not-stated" ? [status, "legacy"] : [status]);
    assert.equal(filterJobs(jobs, { ...filters, locationQuery: "London" }).length, 0);
    const chip = getActiveFilterItems(filters).find((item) => item.id === "sponsorship")!;
    assert.equal(filterReducer(filters, chip.clearAction).sponsorship, "Any");
    assert.equal(filterJobs(jobs, filterReducer(filters, { type: "clear" })).length, jobs.length);
  }
});

test("sponsorship URLs roundtrip every status and clear without removing unrelated parameters", () => {
  for (const sponsorship of sponsorshipStatuses) {
    const filters = { ...initialFilterState, sponsorship };
    const params = mergeFilterStateIntoSearchParams(new URLSearchParams("utm_source=test"), filters);
    assert.equal(params.get("sponsorship"), sponsorship);
    assert.deepEqual(filterStateFromSearchParams(params), filters);
    assert.equal(mergeFilterStateIntoSearchParams(params, initialFilterState).toString(), "utm_source=test");
  }
  assert.equal(filterStateFromSearchParams(new URLSearchParams("sponsorship=yes")).sponsorship, "Any");
});
