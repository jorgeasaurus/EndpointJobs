# Endpoint Jobs Plan

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
