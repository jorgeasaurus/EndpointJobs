import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initialFilterState } from "../../src/components/job-board/filter-model";
import {
  decodePreferences,
  encodePreferences,
  filtersForPreferenceSave,
  preferenceRow,
  shouldRestoreSavedFilters
} from "../../src/lib/account/preferences";
import {
  buildAccountExport,
  deleteAccountConfirmation,
  deletionConfirmed,
  hideViewedJobs,
  savedJobSnapshot
} from "../../src/lib/account/records";
import {
  listSavedIds,
  readPreferences,
  type AccountClient
} from "../../src/lib/account/store";

import { importWithStubs } from "./harness-bundle";

test("saved board filters restore only on a clean board URL", () => {
  const filters = { ...initialFilterState, query: "Intune", salaryOnly: true };
  const stored = encodePreferences({ filters, hideViewed: true, savedOnly: false });
  const decoded = decodePreferences(stored);
  assert.equal(decoded?.filters.query, "Intune");
  assert.equal(decoded?.filters.salaryOnly, true);
  assert.equal(decoded?.hideViewed, true);
  assert.equal(shouldRestoreSavedFilters("/board", ""), true);
  assert.equal(shouldRestoreSavedFilters("/board", "?q=Jamf"), false);
  assert.equal(shouldRestoreSavedFilters("/intune", ""), false);
  assert.equal(decodePreferences(null), null);
  assert.equal(decodePreferences([]), null);
});

test("hide viewed on a shared board keeps the saved search", () => {
  const saved = { ...initialFilterState, query: "Intune" };
  const shared = { ...initialFilterState, query: "Jamf" };
  const kept = filtersForPreferenceSave({
    pageFilters: shared,
    savedFilters: saved,
    pageFiltersOwned: false
  });
  assert.equal(kept.query, "Intune");
  const keptRecord = encodePreferences({ filters: kept, hideViewed: true, savedOnly: false });
  assert.equal(keptRecord.q, "Intune");
  assert.equal(keptRecord.hideViewed, true);

  const edited = filtersForPreferenceSave({
    pageFilters: shared,
    savedFilters: saved,
    pageFiltersOwned: true
  });
  assert.equal(edited.query, "Jamf");
  assert.equal(
    filtersForPreferenceSave({
      pageFilters: shared,
      savedFilters: null,
      pageFiltersOwned: false
    }).query,
    "Jamf"
  );
});

test("deleting an account signs out before the next page load", () => {
  const route = readFileSync(new URL("../../src/app/api/account/delete/route.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../../src/app/account/account-actions.tsx", import.meta.url), "utf8");
  const hook = readFileSync(new URL("../../src/components/job-board/use-account-board.ts", import.meta.url), "utf8");
  assert.match(route, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.match(route, /authCookiesToClear/);
  assert.match(actions, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.ok(actions.indexOf("signOut") < actions.indexOf('window.location.assign("/")'));
  assert.equal(hook.split("filtersRef.current = filters;").length, 2);
  assert.match(hook, /useEffect\(\(\) => \{\n\s+filtersRef\.current = filters;/);
});

test("preference rows keep schema version 1", () => {
  const row = preferenceRow("user-1", { filters: initialFilterState, hideViewed: false, savedOnly: false }, "2026-10-27T00:00:00.000Z");
  assert.equal(row.user_id, "user-1");
  assert.equal(row.schema_version, 1);
  assert.equal(row.filters.hideViewed, false);
  assert.equal(row.updated_at, "2026-10-27T00:00:00.000Z");
});

test("viewed jobs can be hidden and saved snapshots stay small", () => {
  const jobs = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(hideViewedJobs(jobs, new Set(["a"]), true).map((job) => job.id), ["b"]);
  assert.deepEqual(hideViewedJobs(jobs, new Set(["a"]), false).map((job) => job.id), ["a", "b"]);
  assert.deepEqual(savedJobSnapshot({
    title: "Endpoint Engineer",
    company: "Example",
    location: "Austin, TX",
    sourceUrl: "https://example.com/job",
    extra: "nope"
  } as never), {
    title: "Endpoint Engineer",
    company: "Example",
    location: "Austin, TX",
    sourceUrl: "https://example.com/job"
  });
});

test("account deletion requires the confirmation phrase", () => {
  assert.equal(deletionConfirmed(deleteAccountConfirmation), true);
  assert.equal(deletionConfirmed("delete"), false);
  assert.equal(deletionConfirmed(undefined), false);
});

test("account export keeps the four user tables", () => {
  const document = buildAccountExport({
    exportedAt: "2026-10-27T00:00:00.000Z",
    profile: { email: "a@example.com" },
    preferences: { filters: {} },
    savedJobs: [],
    jobViews: [{ job_id: "job-1" }]
  });
  assert.deepEqual(Object.keys(document), ["exportedAt", "profile", "preferences", "savedJobs", "jobViews"]);
});

test("account store reads preferences and saved jobs for the signed-in user", async () => {
  const calls: unknown[] = [];
  const client = fakeClient(calls, {
    preferences: { filters: { q: "Intune", hideViewed: true }, schema_version: 1 },
    saved: [{ job_id: "job-1", job_snapshot: { title: "Role", company: "Co", location: "Austin", sourceUrl: "https://example.com" }, saved_at: "2026-10-27T00:00:00.000Z" }]
  });
  const preferences = await readPreferences(client, "user-1");
  assert.equal(preferences?.filters.query, "Intune");
  assert.equal(preferences?.hideViewed, true);
  assert.deepEqual(await listSavedIds(client, "user-1"), ["job-1"]);
  assert.deepEqual(calls, [
    { table: "user_preferences", op: "select" },
    { table: "saved_jobs", op: "select" }
  ]);
});

test("the account page and privacy policy link to each other", () => {
  const privacy = readFileSync(new URL("../../src/app/privacy/page.tsx", import.meta.url), "utf8");
  const account = [
    readFileSync(new URL("../../src/app/account/page.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../../src/app/account/account-actions.tsx", import.meta.url), "utf8")
  ].join("\n");
  const menu = readFileSync(new URL("../../src/components/auth/account-menu.tsx", import.meta.url), "utf8");
  assert.match(privacy, /href="\/account"/);
  assert.match(account, /Export my data/);
  assert.match(account, /Clear view history/);
  assert.match(account, /Delete account/);
  assert.match(menu, /href="\/account"/);
  assert.match(menu, /Escape/);
  assert.match(menu, /pointerdown/);
});

function fakeClient(calls: unknown[], seed: { preferences: unknown; saved: unknown[] }): AccountClient {
  return {
    from(table) {
      return {
        select() {
          calls.push({ table, op: "select" });
          const data = table === "user_preferences" ? seed.preferences : table === "saved_jobs" ? seed.saved : [];
          const result = Promise.resolve({ data, error: null });
          return { eq: () => Object.assign(result, { maybeSingle: () => result, order: () => result }) };
        }
      };
    }
  };
}

const routes = importWithStubs<typeof import("./fixtures/account-routes")>(
  new URL("./fixtures/account-routes.ts", import.meta.url),
  { "@/lib/account/require-user": new URL("./fixtures/stubs/account-route-session.ts", import.meta.url) }
);

function jsonRequest(method: "POST" | "PUT", body: unknown) {
  return new Request("http://board.test/api/account", { method, body: JSON.stringify(body) });
}

test("the preference and view routes write for the session user, whatever the body names", async () => {
  const { postView, putPreferences, writes } = await routes;
  writes.length = 0;
  const saved = await putPreferences(jsonRequest("PUT", { user_id: "user-2", q: "Intune", hideViewed: true }));
  const viewed = await postView(jsonRequest("POST", { userId: "user-2", jobId: "job-3" }));

  assert.equal(saved.status, 200);
  assert.equal(viewed.status, 200);
  const [preferences, view] = writes;
  assert.equal(preferences?.table, "user_preferences");
  assert.equal(preferences?.values.user_id, "user-1");
  const stored = decodePreferences(preferences?.values.filters);
  assert.equal(stored?.filters.query, "Intune");
  assert.equal(stored?.hideViewed, true);
  // record_job_view takes the user from auth.uid(), so the call names only the job.
  assert.deepEqual(view, { rpc: "record_job_view", values: { p_job_id: "job-3" } });
});

test("the views route needs a job id, and both write routes need a session", async () => {
  const { postView, putPreferences, setSignedIn, writes } = await routes;
  writes.length = 0;
  assert.equal((await postView(jsonRequest("POST", {}))).status, 400);
  setSignedIn(false);
  try {
    assert.equal((await putPreferences(jsonRequest("PUT", {}))).status, 401);
    assert.equal((await postView(jsonRequest("POST", { jobId: "job-3" }))).status, 401);
  } finally {
    setSignedIn(true);
  }
  assert.deepEqual(writes, []);
});
