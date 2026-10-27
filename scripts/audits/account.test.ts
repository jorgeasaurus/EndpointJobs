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
  recordJobView,
  saveJob,
  upsertPreferences,
  type AccountClient
} from "../../src/lib/account/store";

test("saved board filters restore only on a clean board URL", () => {
  const filters = { ...initialFilterState, query: "Intune", salaryOnly: true };
  const stored = encodePreferences(filters, true);
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
  assert.equal(encodePreferences(kept, true).q, "Intune");
  assert.equal(encodePreferences(kept, true).hideViewed, true);

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
  const row = preferenceRow("user-1", initialFilterState, false, "2026-10-27T00:00:00.000Z");
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

test("account store writes preferences, views, and saved jobs for the signed-in user", async () => {
  const calls: unknown[] = [];
  const client = fakeClient(calls, {
    preferences: { filters: { q: "Intune", hideViewed: true }, schema_version: 1 },
    saved: [{ job_id: "job-1", job_snapshot: { title: "Role", company: "Co", location: "Austin", sourceUrl: "https://example.com" }, saved_at: "2026-10-27T00:00:00.000Z" }]
  });
  await upsertPreferences(client, "user-1", { ...initialFilterState, query: "Intune" }, false, "2026-10-27T00:00:00.000Z");
  const preferences = await readPreferences(client, "user-1");
  assert.equal(preferences?.filters.query, "Intune");
  assert.equal(preferences?.hideViewed, true);
  await recordJobView(client, "job-1");
  await saveJob(client, "user-1", {
    id: "job-1",
    title: "Role",
    company: "Co",
    location: "Austin",
    sourceUrl: "https://example.com"
  });
  assert.deepEqual(await listSavedIds(client, "user-1"), ["job-1"]);
  assert.deepEqual(calls, [
    { table: "user_preferences", op: "upsert" },
    { table: "user_preferences", op: "select" },
    { rpc: "record_job_view", jobId: "job-1" },
    { table: "saved_jobs", op: "upsert" },
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
        upsert() {
          calls.push({ table, op: "upsert" });
          return Promise.resolve({ error: null });
        },
        insert() {
          calls.push({ table, op: "insert" });
          return Promise.resolve({ error: null });
        },
        select() {
          calls.push({ table, op: "select" });
          const data = table === "user_preferences" ? seed.preferences : table === "saved_jobs" ? seed.saved : [];
          return {
            eq() {
              return {
                eq: () => Promise.resolve({ data, error: null }),
                maybeSingle: () => Promise.resolve({ data, error: null }),
                order: () => Promise.resolve({ data, error: null }),
                then: (resolve: (value: { data: unknown; error: null }) => void) => resolve({ data, error: null })
              };
            }
          } as never;
        },
        delete() {
          calls.push({ table, op: "delete" });
          return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } as never;
        }
      };
    },
    rpc(_name, args) {
      calls.push({ rpc: "record_job_view", jobId: args.p_job_id });
      return Promise.resolve({ error: null });
    }
  };
}
