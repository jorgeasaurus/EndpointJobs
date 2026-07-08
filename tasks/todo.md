# Endpoint Jobs Plan

## PR Comment Fixes

- [x] Fetch follow-up Copilot review thread for PR #7.
- [x] Make blank `Error.message` formatting fall back to the error name.
- [x] Add audit coverage for blank Error-message formatting.
- [x] Run verification and push the branch update.

Result: Addressed the follow-up Copilot thread. Verified focused formatter check, `git diff --check`, `npm run lint`, `npm run typecheck`, `npm run audit:data`, and `npm run build`.

## Initial PR Comment Fixes

- [x] Fetch unresolved review threads for PR #7.
- [x] Cache normalized map-location keys.
- [x] Improve provider error formatting for plain thrown objects.
- [x] Run verification and push the branch update.

Result: Addressed both unresolved Copilot review threads. Verified focused map/error checks, `git diff --check`, `npm run lint`, `npm run typecheck`, `npm run audit:data`, and `npm run build`.

## PowerShell Filter Branch Check

- [x] Compare stale local branch state with the pushed PR branch.
- [x] Verify PowerShell appears in taxonomy, feed data, and rendered controls.
- [x] Add browser regression coverage for the desktop and mobile PowerShell tool filter.
- [x] Push the PR branch update.

Result: The pushed PR branch already carried the PowerShell filter from `main`; the local checkout was stale and divergent. Added browser audit coverage so the PowerShell tool chip cannot disappear from desktop or mobile controls unnoticed.

## EU Job Country Coverage PR

- [x] Add Switzerland, Italy, Spain, and France to country-aware provider config.
- [x] Add EU/Swiss map anchors with diacritic-safe matching.
- [x] Preserve partial country-provider results when one subfetch fails.
- [x] Rebase onto current `main` and open a draft PR.
- [x] Refresh generated feed data and verify the Vercel preview includes CH/IT/ES/FR jobs.

Result: Draft PR #7 opened. Refresh workflow run `28947230936` committed 402 generated jobs as `d799d26`, including 30 Switzerland, 13 Italy, 12 Spain, and 22 France matches. Verified the protected Vercel preview with `vercel curl`.

## Address Taxonomy Review Findings

- [x] Move job taxonomy into one canonical module.
- [x] Derive refresh role signals from shared taxonomy data.
- [x] Decouple provider search queries from LinkedIn title filters.
- [x] Update audits for the new taxonomy boundary.
- [x] Run verification, commit, and push.

Result: Replaced the narrow endpoint-tool module with a canonical job taxonomy module covering tools, platforms, seniority, role families, aliases, and ordered inference rules. The refresh script now consumes taxonomy data and uses a rule matcher instead of a PowerShell-specific role-family branch. Search query defaults and RapidAPI LinkedIn title filters are explicit arrays again. Verified `npm run typecheck`, `npm run lint`, `npm run audit:data` (56/56), `npm run build`, `git diff --check`, and targeted role-family inference.

## Address PowerShell Review Findings

- [x] Centralize endpoint tool definitions.
- [x] Centralize PowerShell/sysadmin search defaults.
- [x] Classify generic PowerShell/sysadmin roles separately from endpoint security.
- [x] Refresh listings and verify checks.
- [x] Commit and push branch update.

Result: Added a shared endpoint tool taxonomy, derived PowerShell/sysadmin search defaults, and `Systems Administration` role-family handling. Workflow run `28912224130` refreshed listings as `864dcd0`; feed now has 317 jobs, 40 PowerShell-tagged jobs, and 22 PowerShell-tagged `Systems Administration` jobs. Verified `npm run typecheck`, `npm run lint`, `npm run audit:data` (56/56), `npm run build`, `git diff --check`, and the workflow build step.

## PowerShell Branch Refresh And Preview

- [x] Confirm branch is pushed.
- [x] Run `Refresh job listings` on `powershell-keyword-filter`.
- [x] Sync any generated listing commit from the workflow.
- [x] Deploy the branch snapshot to Vercel preview.
- [x] Inspect preview readiness and document result.

Result: Workflow run `28910948065` completed successfully and committed refreshed listings as `bb625b1`. Refreshed feed has 318 jobs, including 40 PowerShell-tagged jobs and 27 PowerShell sysadmin/system-administrator title matches. Vercel preview `dpl_HeQR4aDgDWtcpMmBfGzja5EgB23t` is Ready at `https://endpoint-jobs-1n74lvw0k-jorgeasaurus-projects.vercel.app`; `vercel curl` returned the preview HTML.

## Broaden PowerShell Sysadmin Coverage

- [x] Make PowerShell a strong relevance signal for technical sysadmin roles.
- [x] Add PowerShell/sysadmin default refresh queries.
- [x] Verify generic PowerShell sysadmin acceptance and false-positive guardrails.
- [x] Commit and push branch update.
- [x] Document result.

Result: Broadened refresh matching so technical titles such as `Systems Administrator` with PowerShell now pass relevance, while generic software roles still fail. Added PowerShell sysadmin query defaults for shared search providers and RapidAPI LinkedIn. Verified `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run audit:data` (56/56), and `npm run build`.

## Publish PowerShell Keyword Filter Branch

- [x] Confirm branch state.
- [x] Commit PowerShell keyword filter changes.
- [x] Push branch to `origin`.
- [x] Document result.

Result: Published branch `powershell-keyword-filter` to `origin`.

## PowerShell Keyword Filter

- [x] Create branch `powershell-keyword-filter` from `main`.
- [x] Add `PowerShell` to the canonical tool filter taxonomy.
- [x] Teach refresh normalization to tag PowerShell mentions.
- [x] Verify URL parsing, active chips, and filtering behavior.
- [x] Document result.

Result: Added `PowerShell` as a tool filter, normalizer alias, SEO/popular-search link, and static feed tag for 29 current matching jobs. Verified `npm run typecheck`, `npm run lint`, `npm run audit:data` (56/56), `npm run build`, `AUDIT_BASE_URL=http://127.0.0.1:3001 npm run audit:browser` (28/28), and `git diff --check`.

## Refresh Action Rebase Failure

- [x] Inspect failed scheduled GitHub Action logs.
- [x] Identify the dirty worktree before `git rebase`.
- [x] Clear tracked generated leftovers after committing `jobs.json`.
- [x] Run focused verification.

Result: Scheduled refresh run `28791668837` failed after a successful refresh/build because `git rebase FETCH_HEAD` found unstaged tracked changes after committing only `src/data/jobs.json`. The workflow now restores tracked non-listing changes before fetching/rebasing. Verified `git diff --check`.

## Increase Job Feed Cap

- [x] Set the refresh job cap to 500 in code and scheduled config.
- [x] Run focused verification.
- [x] Document result.

Result: Raised the default refresh cap and scheduled `JOB_MAX_RESULTS` from the previous 80/300 split to 500, then hardened invalid env parsing after PR review. Verified `npm run typecheck`, `npm run audit:data`, and `git diff --check`.

## Add Workday And Greenhouse Companies

- [x] Validate candidate Workday and Greenhouse sources through their public ATS APIs.
- [x] Add only working sources with endpoint-relevant search coverage.
- [x] Keep scheduled refresh configuration in sync with provider defaults.
- [x] Run targeted refresh and project checks.
- [x] Document result.

Result: Added Workday sources for Vanguard, CACI, KBR, The Hartford, RBC, Autodesk, Capital One, and Thermo Fisher, plus Greenhouse boards for Huntress, Keeper Security, Truveta, Intercom, Amplitude, and Ubiquiti. Targeted Workday refresh fetched 276 raw postings and accepted 16 endpoint jobs; targeted Greenhouse refresh fetched 485 raw postings and accepted 10 endpoint jobs. Verified `npm run lint`, `npm run typecheck`, `npm run audit:data`, and `git diff --check`.

## CSS Browser Compatibility Prefixes

- [x] Find every `mask-image` and `user-select` declaration.
- [x] Add `-webkit-mask-image` and `-webkit-user-select` companions.
- [x] Verify prefix pairs and project checks.
- [x] Push the PR update.

Result: Added WebKit-prefixed fallbacks for `mask-image` in `globals.css` and `job-board-map.css`, plus `-webkit-user-select` for the interactive map canvas. Verified prefix pairs, `git diff --check`, `npm run lint`, `npm run typecheck`, and `npx react-doctor@latest --verbose --scope changed`.

## Open Imagegen Redesign PR

- [x] Confirm GitHub auth and remote.
- [x] Commit the verified working tree.
- [x] Push `imagegen-redesign`.
- [x] Open a PR against `main`.
- [x] Document the PR URL.

Result: Opened PR #4 against `main`: https://github.com/jorgeasaurus/EndpointJobs/pull/4. Branch `imagegen-redesign` is pushed to `origin`.

## Filter Vertical Spacing Cleanup

- [x] Inspect filter row markup and CSS spacing.
- [x] Add explicit separation between the primary filter grid and platform buttons.
- [x] Verify browser geometry and screenshots.
- [x] Run lint, typecheck, React Doctor, and diff checks.

Result: Added a 14px sibling gap after the primary filter grid so platform buttons no longer touch the Role/Freshness row when no active filter chips are shown. Verified a 14px grid-to-platform gap at 2032x976, 1100x620, and 940x520. Screenshot: `/tmp/endpointjobs-vertical-spacing-medium.png`. Verified `git diff --check`, `npm run lint`, `npm run typecheck`, and `npx react-doctor@latest --verbose --scope changed`.

## Filter Horizontal Spacing Cleanup

- [x] Constrain compact filter widths.
- [x] Keep location search flexible.
- [x] Remove mobile horizontal scroll from filter chip rows.
- [x] Verify wide, medium, and mobile layouts.
- [x] Run lint, typecheck, React Doctor, and diff checks.

Result: Capped compact filter tracks, kept city search as the flexible field, and changed mobile platform/tool chips to wrap instead of scrolling sideways. Verified no filter overflow at 2032x976, 1100x900, and 390x844 with the mobile drawer open. Fresh screenshots: `/tmp/endpointjobs-spacing-medium-final.png` and `/tmp/endpointjobs-spacing-mobile-final.png`. Verified `git diff --check`, `npm run lint`, `npm run typecheck`, and `npx react-doctor@latest --verbose --scope changed`.

## Filter Label And Padding Recheck

- [x] Confirm current source uses short neutral labels.
- [x] Verify current desktop and mobile render.
- [x] Check filter controls for overflow.

Result: Current source and local render already use `All` and `Any` labels, with no filter-control overflow at 2032x976 or 390x844. Fresh screenshots: `/tmp/endpointjobs-filter-recheck-desktop.png` and `/tmp/endpointjobs-filter-recheck-mobile.png`.

## Add Jabil Workday Source

- [x] Verify `https://jabil.wd5.myworkdayjobs.com/` exposes usable Workday jobs.
- [x] Add Jabil to default Workday source configuration if viable.
- [x] Keep scheduled refresh configuration in sync.
- [x] Run targeted refresh/audit checks.
- [x] Document result.

Result: Added Jabil via `https://jabil.wd5.myworkdayjobs.com/wday/cxs/jabil/Jabil_Careers/jobs`. Jabil-only refresh fetched 11 raw Workday postings and accepted 1 endpoint job, `Information Security Architect (Endpoints and Servers)`. Full default Workday refresh to `/tmp` fetched 412 raw Workday postings and accepted 45 endpoint jobs, including the Jabil listing. Verified `npm run audit:data`, `npm run lint`, `npm run typecheck`, and `git diff --check`.

## Filter Label And Padding Cleanup

- [x] Shorten neutral filter labels so they fit compact controls.
- [x] Tighten filter control padding and grid behavior.
- [x] Verify desktop and mobile filter layouts.
- [x] Run lint, typecheck, React Doctor, and diff checks.
- [x] Document result.

Result: Shortened neutral select labels to `All` and `Any`, tightened filter control padding/gaps, and added shrink-safe overflow handling. Verified desktop and mobile screenshots plus browser overflow checks, `git diff --check`, `npm run lint`, `npm run typecheck`, and `npx react-doctor@latest --verbose --scope changed`.

## Remove Topbar Tabs

- [x] Remove the unnecessary `Search`, `Coverage`, and `Open roles` tab strip.
- [x] Remove dead tab styling if it is no longer used.
- [x] Verify the app still passes targeted checks.
- [x] Document result.

Result: Removed the topbar section-link tab strip and its unused tab styles. Verified no tab class/link references remain, plus `git diff --check`, `npm run lint`, `npm run typecheck`, and `npx react-doctor@latest --verbose --scope changed`.

## React Doctor CI and Top Findings

- [x] Install React Doctor CI scanning.
- [x] Read the supplied React Doctor result files.
- [x] Fetch canonical rule guidance before editing.
- [x] Fix `prefer-tag-over-role` in `job-map.tsx`.
- [x] Fix reported `deslop/unused-export` exports.
- [x] Re-run React Doctor and project gates.
- [x] Document result.

Result: React Doctor CI already existed; installer confirmed local setup, and the workflow now uses `fetch-depth: 0` per the CI guide. Fixed all five supplied findings. Verified `npx react-doctor@latest --verbose` with React Doctor v0.7.1 reporting no issues and 100/100, plus `git diff --check`, `npm run lint`, and `npm run typecheck`.

## Rebase Imagegen Redesign Against Main

- [x] Preserve current uncommitted work.
- [x] Fetch latest `origin/main`.
- [x] Rebase `imagegen-redesign` onto latest main.
- [x] Restore local work and resolve conflicts if needed.
- [x] Verify final branch status.
- [x] Document rebase result.

Result: Rebasing `imagegen-redesign` onto fetched `origin/main` completed cleanly at `b4f4d47`. Local edits were stashed before the rebase and restored without conflicts. Verified `git diff --check`, `npm run lint`, and `npm run typecheck`.

## Imagegen Redesign Preview Deploy

- [x] Confirm branch and Vercel project link.
- [x] Deploy current local snapshot to Vercel preview.
- [x] Inspect preview readiness and access.
- [x] Document preview result.

Result: Deployed preview `dpl_12vxbbkb8b1t46kfkr4YBSABVCUT` at `https://endpoint-jobs-3edg1pqjv-jorgeasaurus-projects.vercel.app`. `vercel inspect` reports target `preview` and status `Ready`; `vercel curl / --deployment` returned the preview HTML successfully.

## Imagegen Redesign Branch

- [x] Create branch `imagegen-redesign`.
- [x] Capture current UI context and generate one imagegen redesign direction.
- [x] Implement the redesign in the existing job-board structure.
- [x] Verify with lint, typecheck, build, and browser checks.
- [x] Document verification result.

Result: Reworked the job board into a compact operations-dashboard layout: sticky nav, split command panel with live coverage metrics, quieter map/results panels, and denser job rows. Imagegen reference: `/Users/jorgeasaurus/.codex/generated_images/019f3141-a1ae-73f0-b027-7f0167df8169/ig_00ff2c2325f7baf0016a4a0d32da908191a81595ee4d6d2cf1.png`. Verified `npm run lint`, `npm run typecheck`, `npm run build`, and `AUDIT_BASE_URL=http://127.0.0.1:3000 npm run audit:browser` with 28/28 browser checks passing.

## Main Production Release

- [x] Upgrade Vercel CLI and confirm repo state.
- [x] Run release verification gates.
- [ ] Commit and push corrected QA changes to `main`.
- [ ] Deploy Vercel production and inspect readiness.
- [ ] Document production deployment result.

## Fresh QA Preview Deploy

- [x] Confirm corrected local snapshot is ready.
- [x] Deploy a fresh Vercel preview.
- [x] Inspect preview readiness and generate share access.
- [x] Document the preview URL.

Result: Deployed preview `dpl_Dnb3PS8pvnXxdox1je3G7Zqq9upX` at `https://endpoint-jobs-gcz06l2a7-jorgeasaurus-projects.vercel.app`. `vercel inspect` reports target `preview` and status `Ready`; Vercel API state is `READY`. Temporary share URL expires 7/5/2026 at 6:04:43 AM as reported by Vercel: `https://endpoint-jobs-gcz06l2a7-jorgeasaurus-projects.vercel.app/?_vercel_share=rMZE5Yyaykv49WFHS86i4xDPWSDYEsvx`. Direct non-browser fetches still follow the Vercel login flow, so validate the share link in a browser session.

## Corrected QA Preview Deploy

- [x] Confirm corrected local QA/overhead changes are ready to deploy.
- [x] Deploy the current local snapshot to a Vercel preview.
- [x] Inspect preview readiness and generate share access.
- [x] Document the preview URL.

Result: Deployed corrected preview `dpl_DafrxUZtZPFeQ2WgLdW3pbCkE1Fi` at `https://endpoint-jobs-ncurecwcw-jorgeasaurus-projects.vercel.app`. `vercel inspect` reports target `preview` and status `Ready`. Temporary share URL expires July 3, 2026 at 2:16:35 PM PDT: `https://endpoint-jobs-ncurecwcw-jorgeasaurus-projects.vercel.app/?_vercel_share=xdBt8jenMMmYCEQyHkb6T84gtQwxdTZD`.

## Thermo-Nuclear Finding Corrections

- [x] Replace live-feed hard-coded browser expectations with feed-derived scenarios.
- [x] Add browser audit page cleanup and shared helpers for chips, URL params, map counts, and clear-all.
- [x] Reduce brittle source-string assertions in the data audit.
- [x] Reuse canonical active-job and filter helpers in browser scenario selection.
- [x] Stage the browser scenario helper so it is not an untracked release hazard.
- [x] Mark scoped MapLibre CSS as a local vendor compatibility boundary.
- [x] Trim old completed task history out of this active checklist.
- [x] Re-run project gates and document results.

Result: Corrected the review findings without keeping the browser audit over 1k lines. The browser scenario helper is now TypeScript, staged in git, and reuses canonical app filtering helpers instead of duplicating active-feed rules. `audit:browser` now runs through `tsx`. Verified lint, data audit 56/56, webpack production build, post-build typecheck, browser audit 28/28, and diff whitespace.

## QA Overhead Preview Deploy

- [x] Confirm the local QA/overhead changes are ready to deploy.
- [x] Deploy the current local snapshot to a Vercel preview.
- [x] Inspect the preview deployment readiness.
- [x] Document the preview URL.

Result: Deployed preview `dpl_FNVgE9CoJfWc8saJoRPk9eVZGTTB` at `https://endpoint-jobs-7wsroj4sz-jorgeasaurus-projects.vercel.app`. `vercel inspect` reports target `preview` and status `Ready`. Temporary share URL expires July 3, 2026 at 1:05:46 PM PDT: `https://endpoint-jobs-7wsroj4sz-jorgeasaurus-projects.vercel.app/?_vercel_share=35ncc5D8Z5HXPTbaPvnoQ50Pqoj5aLHO`.

## Runtime Overhead QA

- [x] Keep footer popular-search anchors, but disable route prefetch.
- [x] Lazy-load the MapLibre canvas behind the Show map action.
- [x] Lazy-load the Three signal field and skip it for reduced motion.
- [x] Replace `slot-text` counters with plain tabular text and remove the dependency.
- [x] Replace global MapLibre CSS with scoped rules for rendered map features.
- [x] Remove client-side map resolver fallback now that active feed rows have persisted `mapLocation`.

Result: Local gates before review cleanup passed lint, typecheck, data audit 56/56, webpack production build, browser audit 28/28, and diff whitespace.

## Browser QA Coverage

- [x] Verify spaced location input preserves spaces and keeps mapped jobs visible.
- [x] Verify encoded-space location URLs hydrate mapped results.
- [x] Verify empty-state reset recovery.
- [x] Verify footer popular searches hydrate filtered result states.
- [x] Verify footer popular searches do not trigger route prefetch on scroll.
- [x] Verify pagination boundaries and top/bottom sync.
- [x] Verify desktop map popup and mobile map sheet behavior.
- [x] Verify filter URL hydration, chip removal, clear-all, and advanced select sorting.

Result: Browser scenarios now derive map and advanced-filter expectations from `src/data/jobs.json`, preferring the original San Diego regression path when it is available but not hard-coding one company, title, or result count.
