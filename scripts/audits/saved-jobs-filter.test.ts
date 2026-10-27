import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getEmptyResultsMessage } from "../../src/components/job-board/empty-results-message";
import { initialFilterState } from "../../src/components/job-board/filter-model";
import { filterStateFromSearchParams } from "../../src/components/job-board/filter-url";
import { boardResultsRequest } from "../../src/components/job-board/use-board-results";
import { devAccountFixture } from "../../src/lib/auth/dev-auth-fixture";
import { queryBoardMap, queryBoardPage } from "../../src/lib/board-page";
import {
  decodePreferences,
  encodePreferences,
  savedOnlyFromBoardSearch
} from "../../src/lib/account/preferences";
import { jobsForBoardView, presentBoardResults } from "../../src/lib/account/records";
import { savedBoardQuery } from "../../src/components/job-board/use-board-results";
import { readE2eSavedIds, savedBoardAccess } from "../../src/lib/account/saved-board";
import { makeJob } from "./shared";

const feed = {
  updatedAt: "2026-10-27T00:00:00.000Z",
  source: { name: "Audit", url: "https://example.com/audit" },
  jobs: [
    makeJob({
      id: "saved-remote",
      title: "Saved remote role",
      company: "Alpha",
      sourceUrl: "https://example.com/saved-remote",
      applyUrl: "https://example.com/saved-remote/apply",
      mapLocation: { label: "Seattle", latitude: 47.6, longitude: -122.3 }
    }),
    makeJob({
      id: "saved-office",
      title: "Saved office role",
      company: "Beta",
      location: "Austin, TX",
      workplace: "On-site",
      sourceUrl: "https://example.com/saved-office",
      applyUrl: "https://example.com/saved-office/apply"
    }),
    makeJob({
      id: "other",
      title: "Unsaved role",
      company: "Gamma",
      tools: ["Jamf"],
      sourceUrl: "https://example.com/unsaved",
      applyUrl: "https://example.com/unsaved/apply"
    })
  ]
};

test("saved jobs only paginates the intersection with the other filters", () => {
  const saved = new Set(["saved-remote", "saved-office", "missing"]);
  const page = queryBoardPage(feed, initialFilterState, 1, 1, saved);
  assert.equal(page.total, 2);
  assert.equal(page.totalPages, 2);
  assert.equal(page.pageSize, 1);
  assert.deepEqual(page.jobs.map((job) => job.id), ["saved-remote"]);
  assert.equal(page.trackedJobsCount, 3);
  assert.equal(queryBoardPage(feed, initialFilterState, 2, 1, saved).jobs[0]?.id, "saved-office");

  const searched = queryBoardPage(feed, { ...initialFilterState, query: "office" }, 1, 20, saved);
  assert.deepEqual(searched.jobs.map((job) => job.id), ["saved-office"]);
  assert.equal(searched.total, 1);

  const none = queryBoardPage(feed, initialFilterState, 4, 20, new Set());
  assert.equal(none.total, 0);
  assert.deepEqual(none.jobs, []);
  assert.equal(none.page, 1);
  assert.equal(none.metrics.remoteJobsCount, 0);

  const unrestricted = queryBoardPage(feed, initialFilterState, 1, 20, null);
  assert.equal(unrestricted.total, 3);
  assert.deepEqual(
    queryBoardMap(feed, initialFilterState, new Set(["saved-remote"])).map((job) => job.id),
    ["saved-remote"]
  );
  assert.deepEqual(
    queryBoardMap(feed, { ...initialFilterState, query: "office" }, new Set(["saved-remote"])).map((job) => job.id),
    []
  );
});

test("a saved job stays visible when hide viewed is also on", () => {
  const jobs = [{ id: "saved-viewed" }, { id: "saved-new" }, { id: "other-viewed" }];
  const savedIds = new Set(["saved-viewed", "saved-new"]);
  const viewedIds = new Set(["saved-viewed", "other-viewed"]);

  assert.deepEqual(
    jobsForBoardView(jobs, { savedIds, savedOnly: true, viewedIds, hideViewed: true }).map((job) => job.id),
    ["saved-viewed", "saved-new"]
  );
  assert.deepEqual(
    jobsForBoardView(jobs, { savedIds, savedOnly: false, viewedIds, hideViewed: true }).map((job) => job.id),
    ["saved-new"]
  );
  assert.deepEqual(
    jobsForBoardView(jobs, {
      savedIds: new Set(["saved-new"]),
      savedOnly: true,
      viewedIds,
      hideViewed: false
    }).map((job) => job.id),
    ["saved-new"]
  );
});

test("saved jobs only is a private preference and a shared URL cannot turn it on", () => {
  const stored = encodePreferences({ ...initialFilterState, query: "Intune" }, true, true);
  const decoded = decodePreferences(stored);
  assert.equal(decoded?.savedOnly, true);
  assert.equal(decoded?.hideViewed, true);
  assert.equal(decoded?.filters.query, "Intune");
  assert.equal(decodePreferences({ q: "Jamf", hideViewed: true })?.savedOnly, false);
  assert.equal(savedOnlyFromBoardSearch("?savedOnly=1&saved=1"), false);
  assert.equal(filterStateFromSearchParams(new URLSearchParams("savedOnly=1&saved=1&q=Jamf")).query, "Jamf");

  const params = filterStateFromSearchParams(new URLSearchParams("q=Jamf"));
  const request = boardResultsRequest(params, 1, { kind: "session", token: "2" });
  assert.equal(request.path, "/api/board/saved");
  assert.equal(request.params.get("saved"), "1");
  assert.equal(request.params.get("q"), "Jamf");
  assert.equal(request.params.has("savedOnly"), false);
  const fixture = boardResultsRequest(initialFilterState, 1, { kind: "fixture", ids: ["job-a", "job-b"] });
  assert.equal(fixture.path, "/api/board/saved");
  assert.equal(fixture.params.get("e2e-saved"), "job-a,job-b");
  const off = boardResultsRequest(initialFilterState, 2, { kind: "off" });
  assert.equal(off.path, "/api/board");
  assert.equal(off.params.get("page"), "2");
  assert.equal(off.params.has("saved"), false);

  assert.equal(devAccountFixture("?e2e-auth=in&savedOnly=1&saved=1", true)?.savedOnly, false);
  assert.deepEqual(devAccountFixture("?e2e-auth=in&e2e-saved=job-a&e2e-saved-only=1&e2e-viewed=job-a&e2e-hide-viewed=1", true), {
    savedIds: ["job-a"],
    viewedIds: ["job-a"],
    hideViewed: true,
    savedOnly: true
  });
  assert.equal(devAccountFixture("?e2e-auth=in&e2e-saved-only=1", false), null);
  assert.equal(devAccountFixture("?savedOnly=1", true), null);
});

test("saved board access uses the caller session and the dev fixture never bypasses production", () => {
  assert.equal(savedBoardAccess({ fixtureIds: null, sessionIds: null }), null);
  assert.deepEqual([...savedBoardAccess({ fixtureIds: null, sessionIds: ["job-a"] }) ?? []], ["job-a"]);
  assert.equal(savedBoardAccess({ fixtureIds: new Set(), sessionIds: ["job-a"] })?.size, 0);
  assert.equal(readE2eSavedIds("job-a,job-b", false), null);
  assert.equal(readE2eSavedIds(null, true), null);
  assert.deepEqual([...readE2eSavedIds("job-a, job-a", true) ?? []], ["job-a"]);
  assert.equal(readE2eSavedIds("", true)?.size, 0);

  const savedRoute = readFileSync(new URL("../../src/app/api/board/saved/route.ts", import.meta.url), "utf8");
  const savedMapRoute = readFileSync(new URL("../../src/app/api/board/saved/map/route.ts", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../../src/app/api/board/saved/saved-ids.ts", import.meta.url), "utf8");
  const publicRoute = readFileSync(new URL("../../src/app/api/board/route.ts", import.meta.url), "utf8");
  assert.match(loader, /requireAccountUser/);
  assert.match(loader, /from\("saved_jobs"\)/);
  assert.match(loader, /user\.id/);
  assert.match(savedRoute, /savedIdsForRequest/);
  assert.match(savedRoute, /private, no-store/);
  assert.match(savedMapRoute, /savedIdsForRequest/);
  assert.match(savedMapRoute, /private, no-store/);
  assert.doesNotMatch(`${loader}\n${savedRoute}\n${savedMapRoute}`, /service_role|SUPABASE_SERVICE_ROLE_KEY|createAdminClient/);
  assert.doesNotMatch(publicRoute, /saved_jobs|requireAccountUser|service_role/);
});

test("unsaving a visible job updates the saved page immediately", () => {
  const page = presentBoardResults({
    jobs: [{ id: "kept" }, { id: "dropped" }],
    total: 2,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    savedIds: new Set(["kept"]),
    viewedIds: new Set(["kept"]),
    savedOnly: true,
    hideViewed: true,
    pendingScope: false,
    loading: false,
    requestedPage: 1
  });
  assert.deepEqual(page.listedJobs.map((job) => job.id), ["kept"]);
  assert.equal(page.totalJobs, 1);
  assert.equal(page.viewingSaved, true);
  assert.equal(savedBoardQuery({
    savedIds: new Set(["kept"]),
    savedOnly: false,
    savedToken: "1",
    signedIn: true,
    usingFixture: false
  }).kind, "off");
});

test("an empty shortlist tells the user to press Save", () => {
  assert.match(getEmptyResultsMessage(initialFilterState, { savedOnly: true, savedJobCount: 0 }), /no saved jobs/i);
  assert.match(getEmptyResultsMessage(initialFilterState, { savedOnly: true, savedJobCount: 0 }), /Save/);
  assert.match(getEmptyResultsMessage(initialFilterState, { savedOnly: true, savedJobCount: 2 }), /saved jobs match/i);
  assert.match(getEmptyResultsMessage({ ...initialFilterState, query: "zzzz" }), /zzzz/);
});
