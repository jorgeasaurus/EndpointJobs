# Handoff: homepage redesign + code-quality loop

Branch: `homepage-critique-quality` (off `main`). Delete this file before the work is merged.

## What is done

- Homepage redesign from an Impeccable critique (score 22/32 → 28/32): hero layout, tool counts linking to `/[tool]` pages (`src/lib/landing.ts`), lead copy, preview ranking with tool tags, freshness, footer as labelled link lists (data table in `src/components/job-board/topbar.tsx`, CSS in `src/app/site-footer.css`), appreciate widget hides until it reports a count.
- Lint 0 errors / 0 warnings, typecheck clean, react-doctor 100/100 (as of the last full run).
- Account preference writes moved to `PUT /api/account/preferences` (server sets `user_id` from the session).
- Thermo-nuclear review round 1: 8 findings, all fixed.
- Thermo-nuclear review round 2: 8 findings. Fixed so far (compiles + lints, **not yet re-tested**):
  - #1 (blocker) `use-account-board.ts` load effect re-ran on every filter change because the `useSyncExternalStore` snapshot was the whole query string. The snapshot now returns only `e2e-*` fixture params.
  - #5 one `useKeyedState` helper for both hooks; source key derived from the union.
  - #7 `encodePreferences(preferences: SavedPreferences)`.

## What is left (round 2)

1. **Regression test for #1** — a real hook test, not a source regex. Pattern to copy: `src/components/job-board/saved-scope-error.test.ts` (esbuild bundle + Chrome). Add esbuild stubs for `@/lib/supabase/client` (fake client: `from(t).select().eq()` thenable with `.eq/.maybeSingle/.order`, count calls on `window`), `@/lib/supabase/env` (`isSupabaseConfigured: () => true`), `@/components/auth/sign-in-session` (`useSignInSession: () => ({ userId: "user-1" })`), and `define: { "process.env.NODE_ENV": '"development"' }`. Harness: filters in `useState`, a button that sets a new query and calls `history.replaceState(null, "", "?q=Intune")`, `window.fetch` records `PUT /api/account/preferences` bodies. Assert: after a filter change the account reads are not repeated and one PUT carries `q=Intune`.
2. **#2** Move the landing tool list into the taxonomy: add `role: "management" | "adjacent"` to every entry in `endpointToolDefinitions` (`src/lib/job-taxonomy.ts`; management = Jamf, Intune, SCCM, Fleet MDM, Kandji, NinjaOne, Workspace ONE, Tanium, Autopilot), export `managementTools`, delete the private list in `landing.ts`. Rank tools by open-role count (ties: taxonomy order) and order card tags by that ranking so Intune still leads on real data. Rename `LandingRole.platformTools` → `managementTools` ("platform" means OS in this codebase). Fix the test comment in `scripts/audits/landing-page.test.ts` ("Tags follow the board's tool order").
3. **#3** Replace `src/app/account/export-account-button.tsx` and `clear-view-history-button.tsx` with one client `AccountActionButton({ action: "export" | "clear-views" })` in `account-actions.tsx` (page.tsx is a server component, so no function props). Move `clearViewHistory` there from `use-account-board.ts`. Keep `signOut` before `window.location.assign("/")` in `account-actions.tsx` (pinned by `scripts/audits/account.test.ts`).
4. **#4** Move `SiteFooter`, `FooterLink`, `footerGroups` into `src/components/job-board/site-footer.tsx`; update the ~11 importers and the source-text audits that read `topbar.tsx` for footer strings (`scripts/audits/roadmap.test.ts`, `review-fixes.test.ts`, `job-card-audits.tsx`, `seo-audits.ts`). Drop the `className` field (`api-docs-link`/`support-link` have no CSS) and the two redundant selectors in `tests/e2e/board.spec.ts` and `e2e/phase2-ui.spec.ts`.
5. **#6** `src/lib/account/store.ts` comment on `AccountClient` claims browser reads only, but `rpc` (`recordJobView`) writes. Make the comment/type honest (the RPC sets `user_id` from `auth.uid()`), or move view recording behind `POST /api/account/views`.
6. **#8** `src/app/landing.css`: a duplicated, mis-indented `.landing-lead` block inside the 560px media query (delete it). `src/app/job-board.css`: take `.refresh-pill` out of the three shared pill selector groups and give it one plain rule instead of the `.topbar .refresh-pill` override.

Then run a **fresh** thermo-nuclear review (unanchored sub-agent) and repeat fix → validate → review until a round returns NO FINDINGS.

Review skill: https://github.com/jorgeasaurus/agent-skills/blob/main/thermo-nuclear-code-quality-review/SKILL.md
Loop rules: https://github.com/jorgeasaurus/agent-skills/blob/main/thermonuclear-review-fix-loop/SKILL.md
Scope: this branch vs `main`. Ignore `.claude/`, `skills-lock.json`, `AGENTS.md`, `CLAUDE.md`, `next-env.d.ts`.

## Validation

```bash
npm install                      # @vercel/blob must be present
npx next typegen                 # regenerate .next/types (stale route types break tsc)
npm run typecheck && npm run lint
PLAYWRIGHT_EXECUTABLE_PATH=<chrome binary> npm test
npx react-doctor . -y --json     # must report score 100
# e2e: start `E2E_FIXTURES=1 NODE_ENV=development npm run dev -- --hostname 127.0.0.1 --port 3000`, then
npx playwright test                                   # e2e/
npx playwright test -c tests/e2e/playwright.config.ts # tests/e2e/
```

Known failures on `main` too (not regressions): unit "prerendered home HTML stays under 100 KB" (needs `next build`); `e2e/critique.spec.ts` ×4 and `e2e/saved-jobs-filter.spec.ts` screenshot test (write to `/opt/cursor/artifacts`); `[FILT-13]` in `tests/e2e/board.spec.ts` is flaky.

Next's dev server writes `AGENTS.md`, `CLAUDE.md` and edits `next-env.d.ts`; never commit those.
