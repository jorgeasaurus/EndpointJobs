# Endpoint Jobs Plan

## SEO Discovery Improvements

- [x] Audit current metadata, robots, sitemap, and structured data.
- [x] Add search-focused metadata and JSON-LD that accurately represents the page.
- [x] Add crawlable specialty links for high-intent endpoint job searches.
- [x] Verify build output and SEO-relevant routes.

Result: Added sharper endpoint engineering metadata, site search/WebApplication/Breadcrumb JSON-LD, crawlable footer links for high-intent searches, stable job anchors, sitemap image metadata, and explicit Googlebot robots coverage. Verified typecheck, lint, data audit, build, browser audit, diff check, and rebuilt static HTML SEO markers.

## Job Map Coverage Fix

- [x] Measure active versus mapped jobs and top unmapped locations.
- [x] Expand map location resolution for high-volume valid feed locations.
- [x] Verify mapped count improves without mapping ambiguous rows offshore.
- [x] Run validation checks and document results.
- [x] Address PR feedback on Workday query failure wording.

Result: Fixed map coverage by moving location resolution into app code, using it as a runtime fallback in map point generation, and adding refresh-time map enrichment for future feeds. Expanded resolver coverage for the highest-volume real feed locations while leaving ambiguous multi-location rows unmapped. Current feed coverage improved from 4 of 173 active jobs to 167 of 173; Playwright verified the page shows `167 mapped jobs`, `167 of 173`, and an expandable visible map canvas. Addressed PR feedback by renaming the Workday guard to completed queries and making the all-failed error message accurate. Verified typecheck, lint, data audit, build, and diff check.

## Adzuna Window And ATS Source Expansion

- [x] Relax Adzuna posted-age freshness from 14 to 30 days.
- [x] Verify large-company Greenhouse/Workday candidates through public ATS APIs.
- [x] Add only responding source boards/sites to defaults and the refresh workflow.
- [x] Run targeted refresh and validation checks.

Result: Increased Adzuna posted-age freshness to 30 days, added verified Greenhouse sources GitLab, Coinbase, Canonical, Pinterest, Block, and Roblox, and expanded Workday defaults/workflow with Booz Allen, HP, NVIDIA, Adobe, plus previously code-only F5/Allstate/Gartner/Nordic/SHI/Circle targets. Workday now skips isolated query failures instead of failing the whole provider. Verified Greenhouse expanded boards, Workday defaults, workflow YAML, 30-day freshness boundary, typecheck, lint, data audit, build, and diff check.

## Expired Adzuna Listing Cleanup

- [x] Verify the reported Adzuna listing and locate the feed row.
- [x] Add a source URL exclusion path for confirmed unavailable listings.
- [x] Remove the reported unavailable listing from the current feed.
- [x] Verify typecheck, lint, build, and feed checks.

Result: Removed `adzuna-5763079616` from the static feed, added a shared source-URL exclusion path for confirmed-dead postings, and added stricter Adzuna freshness so stale aggregator rows are hidden if the provider feed is not refreshed. The app now sanitizes the feed before rendering and JSON-LD, refresh output filters excluded/freshness-expired rows before dedupe, and the scheduled workflow supports `JOB_EXCLUDED_SOURCE_URLS` for future aggregator misses. Verified the exclusion helper, feed removal, active feed count, typecheck, lint, build, browser audit 13/13, and React Doctor 100/100.

## SpaceX Greenhouse Source

- [x] Verify the SpaceX Greenhouse board slug.
- [x] Add SpaceX to default and scheduled Greenhouse source lists.
- [x] Verify the targeted board fetch and app build checks.

Result: Added Greenhouse board `spacex` to the default and scheduled source lists. Verified the board returns 1,798 raw jobs and the adapter currently normalizes 6 endpoint-relevant matches, including SpaceX endpoint and Windows engineering roles. Verified typecheck, lint, and build.

## Main And Production Publish

- [x] Commit the current map and source-refresh work.
- [x] Push the resulting commit to `main`.
- [x] Deploy Vercel production and confirm it is ready.

Result: Merged the expandable map and source-refresh work into `main`, pushed to GitHub, and deployed Vercel production at `https://endpointjobs.dev`.

## Optional Job Map

- [x] Collapse the job map by default behind an explicit button.
- [x] Avoid loading MapLibre until the user expands the map.
- [x] Update browser verification to expand the map before map assertions.
- [x] Verify lint, build, audit, and desktop/mobile screenshots.

Result: The Job geography section now loads as a compact collapsed panel with a Show map button, mounts MapLibre only after expansion, and toggles to Hide map with `aria-expanded`/`aria-controls` wired. Verified typecheck, lint, build, React Doctor 100/100, browser audit 13/13, and Playwright screenshots in `/tmp/endpoint-map-optional-*`.

## Map Header Padding

- [x] Add balanced header padding to the map section.
- [x] Verify the map still builds and renders on desktop/mobile.

Result: Increased the map heading inset so the title and mapped-job count pill no longer sit against the frame while leaving the map canvas flush beneath the header. Verified lint, build, and Playwright screenshots.

## Review Findings Cleanup

- [x] Update the browser audit after the Three signal background cleanup.
- [x] Simplify map location and job-map feature contracts.
- [x] Convert match-reason derivation from branch growth to rule data.
- [x] Remove dead UI fallback branches now enforced by feed validation.
- [x] Run typecheck, lint, build, React Doctor, and frontend design smoke checks.

Result: Updated the browser audit for the current Three.js signal canvas, simplified map feature typing and location normalization, converted match reasons to data-driven rules, removed the dead match-reason UI fallback, and tuned mobile map fitting so global edge clusters stay visible. Verified typecheck, lint, build, React Doctor 100/100, browser audit 12/12, and frontend-design desktop/mobile screenshots in `/tmp/endpoint-frontend-design-*`.

## Review Cleanup Implementation

- [x] Extract map-specific CSS from the global board styles.
- [x] Split the MapLibre job map into focused style, data, and popup modules.
- [x] Move map coordinates toward the job data boundary and simplify client fallbacks.
- [x] Slim the Three signal background internals and reduce duplicate fallback visuals.
- [x] Verify typecheck, lint, build, and line-count targets.

Result: Extracted map styles into `job-board-map.css`, reduced `job-board.css` to 976 lines, split map config/features/popup modules, moved map coordinates into generated job data, removed client match-reason synthesis, and slimmed the Three background component. Verified typecheck, lint, build, diff whitespace, feed integrity, and Playwright desktop/mobile smoke screenshots in `/tmp/endpoint-review-cleanup-*`.

## Three r185 Signal Background

- [x] Install `three@0.185.0`.
- [x] Replace the CSS-only parallax stars with a full-bleed Three.js signal field.
- [x] Keep the existing obsidian/lime visual system and reduced-motion fallback.
- [x] Verify lint, typecheck, build, desktop/mobile screenshots, and canvas pixels.
- [x] Deploy a Vercel preview and verify the deployment is ready.

Result: Added a full-bleed Three r185 endpoint signal field behind the dashboard while preserving the CSS star fallback. Verified `npm run typecheck`, `npm run lint`, `npm run build`, Playwright desktop/mobile canvas pixel motion checks in `/tmp/endpoint-three-signal`, and Vercel preview `dpl_4GkkqqLvJ3NcnTopPhuwUBWd8GX6`.

## MapLibre Job Map Implementation

- [x] Add MapLibre/React map dependencies.
- [x] Replace the custom Three.js map with clustered GeoJSON points.
- [x] Preserve hover/tap job details with title, company, salary, and apply link.
- [x] Match the existing obsidian/lime page styling and improve mobile interaction.
- [x] Verify lint, typecheck, build, and Playwright desktop/mobile screenshots.

Result: Replaced the custom Three.js map with MapLibre, a dark OSM/CARTO basemap, clustered GeoJSON job points, focused zoom controls, desktop popups, and a mobile tap sheet. Verified `npm run typecheck`, `npm run lint`, `npm run build`, and Playwright desktop/mobile screenshots in `/tmp/endpoint-maplibre-final`.

## Spec

Build a Vercel-ready Next.js site for Endpoint Engineering job discovery. The first screen is the usable job board: search, role filters, platform/tool filters, freshness, remote/location filtering, and saved static listings generated by a daily GitHub Action.

Design direction: Superdesign-inspired high-contrast editorial/product UI with dense controls, crisp typography, kinetic accents, and endpoint-tool visual language. Avoid a generic landing page.

Data direction: keep the app static and cheap to host. Add a provider-based ingestion script that queries a job API daily, filters for Endpoint Engineering/macOS/Windows/Jamf/Intune/SCCM/Fleet MDM/Kandji/NinjaOne terms, normalizes results, de-dupes, and writes `src/data/jobs.json`.

## Tasks

- [x] Scaffold Next.js App Router app with TypeScript, Tailwind, lint/build scripts, and Vercel-compatible defaults.
- [x] Build a production-grade job board UI with responsive desktop/mobile layouts and accessible filters.
- [x] Add typed job data model, seed data, client-side search/filter/sort behavior, freshness filtering, and source attribution fields.
- [x] Add daily GitHub Action and ingestion script for a configurable job-listing API with stale listing cleanup.
- [x] Add setup documentation in the README for API secrets and Vercel deployment.
- [x] Verify with lint/build and local browser inspection.

## Review

Implemented Next.js job board, Remotive/Remote OK ingestion, daily refresh workflow, and Vercel config.

Verified:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run jobs:refresh`
- Playwright desktop and mobile screenshots

Note: Remotive currently returned zero strict endpoint matches, so refresh leaves the curated seed feed unchanged unless the API returns relevant roles.

## Location Filtering

- [x] Add multi-select location chips from real feed locations.
- [x] Add free-text location search.
- [x] Add separate workplace type filtering.
- [x] URL-sync the new filters.
- [x] Verify typecheck, lint, build, and mobile layout.

Result: Added feed-derived location chips, free-text location search, and separate workplace filtering with URL sync. Verified typecheck, lint, build, and 390px mobile browser behavior with no horizontal overflow.

## Thermo-Nuclear Location Filter Review

- [x] Extract location UI out of the general controls component.
- [x] Move location-specific styles out of the oversized base stylesheet.
- [x] Simplify location URL parsing to the canonical repeated-param model.
- [x] Re-run typecheck, lint, build, and mobile browser checks.

Result: Split location controls into `location-filters.tsx`, moved search and location styles into focused CSS files, brought `job-board.css` below 1k lines, and removed the legacy double-encoded location parser branch.

## Remove Location Quick Chips

- [x] Remove the feed-derived location chip row from the hero.
- [x] Delete unused multi-select location state, URL params, and CSS.
- [x] Verify typecheck, lint, build, and mobile layout.

## React Doctor And Thermo-Nuclear Cleanup

- [x] Capture React Doctor baseline and rule details.
- [x] Fix React Doctor findings until the checker reports no issues.
- [x] Run a thermo-nuclear structural review of the current diff and touched modules.
- [x] Address every structural finding without suppressing rules.
- [x] Verify typecheck, lint, build, React Doctor, diff hygiene, and relevant UI behavior.
- [x] Document final results.

Result: React Doctor was already clean and stayed `100 / 100`. The strict review removed stale location-chip abstractions, separated current URL filter keys from legacy cleanup keys, and verified the production build at 390px: no location chip row, no horizontal overflow, direct URL filters hydrate, and legacy `locations` params collapse after interaction.

## Publish Location Filters

- [x] Commit location-filter and review cleanup changes.
- [x] Push `dev` to GitHub.
- [x] Deploy a Vercel preview.
- [ ] Dispatch the refresh workflow against `dev`.

Result: Pushed `451f765` to `dev` and deployed preview `https://endpoint-jobs-mj2tqi9jc-jorgeasaurus-projects.vercel.app`.

## Merge Dev To Production

- [x] Merge `dev` into `main`.
- [x] Verify React Doctor, typecheck, lint, build, and diff hygiene on `main`.
- [x] Push `main` to GitHub.
- [x] Deploy Vercel production.
- [x] Document production URL.

Result: Fast-forwarded `main` to `7df5b2b`, pushed to GitHub, and deployed production `dpl_GGowY2vwkvyA9ow4T6akzztcLyYg`, aliased at `https://endpointjobs.dev`.

## LinkedIn API Provider Spike

- [x] Create an isolated branch for the investigation.
- [x] Review current provider ingestion boundaries.
- [x] Verify what `linkedin-api-js-client` supports and what LinkedIn access is required.
- [x] Evaluate the RapidAPI LinkedIn Job Search alternative.
- [x] Add an optional provider if the API shape fits the ingestion model.
- [x] Run verification.

Result: Do not install `linkedin-api-client`. It is useful only after approved LinkedIn API access exists, and LinkedIn's documented Job Posting API is for authorized partners posting jobs to LinkedIn, not discovering public LinkedIn listings for this feed. Added an optional `rapidapilinkedin` provider for the RapidAPI LinkedIn Job Search API, gated by `RAPIDAPI_LINKEDIN_JOBS_KEY`.

## Repo Move And Publish

- [x] Move repo to `~/Code/EndpointJobs`.
- [x] Create initial commit.
- [x] Create GitHub repo and push.
- [x] Verify remote state.

## Obsidian Lime Style Refresh

- [x] Apply black/obsidian, lime, emerald, glass, grid, noise, and glow styling.
- [x] Update SVG/icon visual assets.
- [x] Verify build and browser rendering.
- [x] Commit and push style update.

## Multi-source Job Refresh Wiring

- [x] Aggregate Remotive, Arbeitnow, Jobicy, and Remote OK in one refresh run.
- [x] De-dupe normalized jobs across providers.
- [x] Update workflow and README configuration.
- [x] Verify refresh and build.
- [x] Commit and push wiring update.

## Vercel Publish

- [x] Verify Vercel CLI/auth.
- [x] Link/create Vercel project.
- [x] Deploy production build.
- [x] Verify deployment URL.

Deployment: https://endpoint-jobs.vercel.app

## Job API Diagnostics

- [x] Verify provider APIs return raw jobs.
- [x] Verify refresh normalization/filtering output.
- [x] Inspect GitHub Action run history.
- [x] Adjust filter/source wiring if needed.
- [x] Re-run validation and push if changed.

Result: 2026-06-13 workflow run 27482502661 on 992f112 fetched Remotive 29, Arbeitnow 100, Jobicy 50, and Remote OK 100; accepted 0 endpoint matches and made no listing changes. Local sampling found only false-positive near matches, so no source/filter code change was needed.

## Source Expansion

- [x] Add public career-board providers for Greenhouse and Lever.
- [x] Add The Muse Computer and IT provider.
- [x] Add optional Adzuna search provider for credentialed production use.
- [x] Tighten relevance matching so vendor company names alone do not qualify a job.
- [x] Update workflow and README source configuration.
- [x] Verify refresh, typecheck, lint, and build.
- [x] Commit and push source expansion.

Result: Expanded refresh fetched 848 raw jobs from 7 successful public providers and wrote 3 endpoint-qualified listings. Adzuna is wired but skipped until `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are set.

## LinkedIn Coverage Correction

- [x] Record screenshot examples as target coverage cases.
- [x] Probe public ATS/search APIs for Accenture, GEICO, PlayStation/Sony, Providence, Docker, Brighton Jones, Amazon, and Robert Half.
- [x] Add source or query coverage that can catch screenshot-style roles without scraping LinkedIn.
- [x] Expand endpoint relevance terms for end-user compute and client engineering while avoiding generic support noise.
- [x] Refresh jobs and verify target-style matches appear.
- [x] Run typecheck, lint, build, commit, push, and verify production.

Result: Expanded coverage fetched 1,450 raw jobs from 10 successful providers and wrote 15 endpoint-qualified listings. Captured screenshot-style targets from Accenture, PlayStation, Amazon, Docker, and Brighton Jones; GEICO and Providence need a stable public API before default inclusion.

## Endpoint Remote Coverage Batch

- [x] Record target examples: Verkada, MSM Technology, Honeywell, Gartner, Intuitive Machines, Anthropic, McGraw Hill, Goodwin, and GDIT.
- [x] Probe stable public ATS/search APIs for those companies.
- [x] Add source/query coverage for stable matches without scraping LinkedIn.
- [x] Adjust relevance rules only where target examples prove a gap.
- [x] Refresh jobs and verify new target-style matches appear.
- [x] Run typecheck, lint, build, commit, push, and verify production.

Result: Expanded coverage fetched 1,948 raw jobs from 11 successful providers and wrote 28 endpoint-qualified listings. Captured target roles from Verkada, Anthropic, McGraw Hill, Goodwin, and GDIT; Gartner, Honeywell, MSM Technology, and Intuitive Machines still need stable public API coverage before default inclusion.

## Broad Endpoint Coverage Batch

- [x] Record target examples: Delta, Leidos, Cardinal Health, Commvault, UT Austin, DoorDash, The Planet Group, Dexcom, Kaseya, Kymera, WME, Hermeus, Pennant, Blue Origin, Providence, and Omnidian.
- [x] Probe stable public ATS/search APIs for those employers.
- [x] Add source/query coverage for stable matches without scraping LinkedIn.
- [x] Adjust relevance rules only where target examples prove a gap.
- [x] Refresh jobs and verify new target-style matches appear.
- [x] Run typecheck, lint, build, commit, push, and verify production.

Result: Expanded coverage fetched 2,581 raw jobs from 12 successful providers and wrote 49 endpoint-qualified listings. Captured target roles from Leidos, Cardinal Health, Commvault, UT Austin, DoorDash, Dexcom, Kaseya, Kymera, Hermeus, Blue Origin, and Omnidian; Delta, The Planet Group, WME, Pennant, and Providence still need stable public API coverage before default inclusion.

## Mobile UI Cleanup

- [x] Remove visible source buttons/links while preserving provider labels.
- [x] Tighten mobile header, search, filters, and job cards for small screens.
- [x] Verify lint/build and mobile rendering.

Result: Removed source CTAs from the header, cards, and footer; kept non-clickable provider attribution; tightened mobile spacing and card density; fixed mobile flex overflow found in Playwright snapshots. Verified lint, typecheck, build, local rendered HTML, and 320/375px browser snapshots.

## NPM Doctor And Thermo-Nuclear Review

- [x] Run npm doctor and capture issues.
- [x] Inspect current branch diff and affected file sizes.
- [x] Review structural quality, mobile CSS maintainability, and source-button removal.
- [x] Report findings with verification status.

Result: npm doctor exited 1 because npm 11.16.0 is behind recommended 11.17.0 and `/opt/homebrew/bin/__pycache__/vba_extract.cpython-313.pyc` is missing executable permission; registry, node, git, PATH, cache, and project permissions passed. Review found one structural CSS maintainability blocker and one mobile chip-row design concern.

## Review Finding Fixes

- [x] Split job-board styles out of the oversized global stylesheet.
- [x] Remove hidden horizontal scrolling from card metadata/tag rows on mobile.
- [x] Verify lint, typecheck, build, and narrow mobile layout.

Result: Split styles into `globals.css` (104 lines), `job-board.css` (784 lines), and `job-board-responsive.css` (328 lines); card chips now wrap on mobile while the platform filter strip remains horizontally scrollable. Updated npm to 11.17.0 and fixed the Homebrew bin permission issue. Verified lint, typecheck, build, npm doctor, rendered HTML, and 320/375px Playwright snapshots.

## Workable And Techmap Source Wiring

- [x] Confirm existing Greenhouse, Ashby, and Lever support.
- [x] Verify Workable and Techmap RSS endpoint shapes.
- [x] Add missing Workable and Techmap RSS providers.
- [x] Update GitHub Action and README provider docs.
- [x] Run refresh, typecheck, lint, build, and source-specific checks.

Result: Greenhouse, Ashby, and Lever were already wired. Added Workable account ingestion and configurable Techmap RSS ingestion, including workflow env/secrets and README setup notes. Verified Workable and Techmap RSS with local mock feeds, `npm run typecheck`, `npm run lint`, `npm run build`, and a temp full refresh that wrote 49 endpoint jobs from 12 providers. `npm audit --audit-level=moderate` still reports the existing Next/PostCSS advisory; npm only offers `npm audit fix --force`, so no forced breaking remediation was applied.

## LinkedIn Provider Review Loop

- [x] Run React Doctor baseline.
- [x] Review current branch changes with thermo-nuclear standards.
- [x] Address every React Doctor and strict review finding.
- [x] Repeat React Doctor until no findings remain.
- [x] Verify typecheck, lint, build, and diff hygiene.
- [x] Document final results.

Result: React Doctor stayed clean at `100 / 100`. Strict review found the RapidAPI LinkedIn provider was too shape-agnostic, so the parser now uses a typed field-alias contract, explicit known response envelopes, visible failure for malformed successful responses, and canonical salary extraction from descriptions. Verified typecheck, lint, mocked provider ingestion, React Doctor, build, and diff hygiene.

## AI Dev Board API Integration

- [x] Inspect `https://aidevboard.com/openapi.yaml`.
- [x] Probe live endpoint-search coverage.
- [x] Add an `aidevboard` provider.
- [x] Wire workflow and README configuration.
- [x] Verify source-specific refresh, typecheck, lint, build, and diff hygiene.

Result: Added the AI Dev Board provider using `GET /api/v1/jobs`, optional `AIDEVBOARD_API_KEY`, endpoint-focused default queries, structured salary/workplace/seniority mapping, and active-listing expiry handling. Live source-only refresh fetched 96 raw jobs and normalized 3 endpoint-relevant jobs into a temp feed.

## Publish Current Changes

- [x] Confirm working tree scope.
- [x] Run final local verification.
- [x] Commit and push to GitHub.
- [x] Deploy production to Vercel.

Result: Pushed current changes to `main` and deployed production to https://endpoint-jobs.vercel.app. Vercel returned Ready and the live alias returned HTTP 200.

## Desktop Background Card Grid

- [x] Add 4-column desktop background card grid.
- [x] Implement large 2x2 data-visualization card, tall 1x2 swatch card, and lime accent card.
- [x] Apply rounded-[2.5rem], border-white/10, lime hover border, and noise texture.
- [x] Verify lint/build and responsive rendering.

Result: Superseded by the Hero Filter Stack Relocation correction below; the decorative signal card grid was removed after review.

## Hero Filter Stack Relocation

- [x] Remove the decorative signal card grid.
- [x] Move Filter Stack controls into the hero command panel.
- [x] Collapse results layout to a single listing column.
- [x] Verify lint/build and desktop/mobile rendering.

Result: Removed the decorative signal card grid shown in the screenshot, moved Seniority/Sort/Tools/Clear controls into the hero command panel, and made the listings area a single full-width column. Verified typecheck, lint, build, desktop DOM layout, and mobile no-overflow behavior.

## Duplicate Job Key Fix

- [x] Trace duplicate Workday job IDs in the feed.
- [x] Make Workday IDs stable and unique beyond truncated location URLs.
- [x] Migrate existing Workday feed IDs.
- [x] Verify lint/build and browser console.

Result: Workday job IDs now include title plus a stable hash of the full source URL, current feed IDs were migrated, and refresh validation now rejects duplicate IDs. Verified current feed and temp refresh output have zero duplicate IDs; `npm run typecheck`, `npm run lint`, `npm run build`, and browser reload checks passed with no duplicate-key console messages.

## Slot Text Hero Enhancement

- [x] Install and inspect `slot-text` React usage.
- [x] Add restrained slot-text animation to hero metadata/count labels.
- [x] Keep job cards and filter controls stable for scanning.
- [x] Verify lint/build and browser behavior.

Result: Installed `slot-text` and used its React component only for numeric status moments: tracked roles, visible opportunities, and the clear-filter count. Job cards and filter labels remain static for scanning; animated digits are hidden from assistive tech with stable labels. Verified `npm run typecheck`, `npm run lint`, `npm run build`, and mobile browser behavior with no duplicate-key warnings or horizontal overflow.

## TheirStack API Wiring

- [x] Add TheirStack as an env-gated refresh provider.
- [x] Map TheirStack job fields into the existing `Job` model.
- [x] Add GitHub Action secret wiring without storing the token in source.
- [x] Verify source-specific refresh, typecheck, lint, build, and feed validation.

Result: Added the `theirstack` provider using `POST /v1/jobs/search` with `THEIRSTACK_API_KEY`, normalized TheirStack jobs into the existing feed model, and wired the GitHub Action to read the token from secrets. Verified with a local mock TheirStack refresh, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`; the real token was not written to source.

## SerpAPI Google Jobs Wiring

- [x] Add SerpAPI Google Jobs as an env-gated refresh provider.
- [x] Map Google Jobs result fields into the existing `Job` model.
- [x] Add GitHub Action secret wiring without storing the token in source.
- [x] Verify source-specific refresh, typecheck, lint, build, and feed validation.

Result: Added the `serpapi` provider using SerpAPI Google Jobs search JSON, normalized `jobs_results` into the existing feed model, and wired the GitHub Action to read `SERPAPI_API_KEY` from secrets. Verified with a local mock SerpAPI refresh, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and a secret-shaped source scan; the real token was not written to source.

## Thermo-Nuclear Finding Fixes

- [x] Extract shared job normalization/building out of the provider monolith.
- [x] Move TheirStack and SerpAPI into dedicated provider adapters.
- [x] Replace repeated provider dispatch metadata with a registry.
- [x] Verify mocked TheirStack/SerpAPI refreshes, typecheck, lint, build, and diff hygiene.

Result: Split shared endpoint normalization into `scripts/job-refresh/shared.ts`, moved TheirStack and SerpAPI into provider adapters, and replaced repeated provider dispatch branches with a registry in `scripts/refresh-jobs.ts`. Main refresh script is now 2,811 lines, down from 4,129 after the provider additions. Verified mocked SerpAPI and TheirStack refreshes, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and a tracked/untracked secret-shaped source scan.

## Thermo-Nuclear Provider Decomposition

- [x] Move remaining provider implementations out of `scripts/refresh-jobs.ts`.
- [x] Split providers into focused modules below the 1k-line smell threshold.
- [x] Keep `scripts/refresh-jobs.ts` as orchestration/feed output only.
- [x] Verify full refresh behavior, provider mocks, typecheck, lint, build, and diff hygiene.

Result: Split public boards, ATS boards, company ATS, and Techmap RSS into focused provider modules. `scripts/refresh-jobs.ts` is now 228 lines; all provider modules are under 1,000 lines. Verified local mocks for Remote OK, Greenhouse, Amazon, Techmap RSS, TheirStack, and SerpAPI; live temp refresh wrote 54 jobs from 12 providers; `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and secret-pattern scan passed.

## Expandable Job Descriptions

- [x] Add a sanitized full-description field to the job data model.
- [x] Persist bounded descriptions from every provider that exposes them.
- [x] Add accessible expandable descriptions under job summaries.
- [x] Refresh the feed and verify description coverage.
- [x] Run typecheck, lint, build, and browser/mobile checks.

Result: Added bounded plain-text descriptions to the feed and a native expandable description panel under every job card. Refreshed feed now has descriptions for 54 of 54 jobs; 26 have longer full descriptions and 28 expose provider snippets only. Verified `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and Playwright mobile/desktop layout checks with no horizontal overflow.

## Rebase After Action Refresh

- [x] Save local expandable-description work before rebasing.
- [x] Fetch and rebase onto the latest `origin/main`.
- [x] Reapply local description changes without losing refreshed job posts.
- [x] Refresh/verify the feed and quality gates.

Result: Rebased `main` onto GitHub Action commit `9ec01c1`, reapplied the expandable-description work, and regenerated `src/data/jobs.json` with the description-aware refresh pipeline. Feed now has 54 jobs, 54 descriptions, 26 longer full descriptions, and 28 provider snippets. Verified `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Duplicate Description Cleanup

- [x] Stop persisting provider snippets as descriptions.
- [x] Render only description text that adds content beyond the summary.
- [x] Refresh the feed and verify expander count drops to meaningful descriptions only.
- [x] Run typecheck, lint, build, and UI checks.

Result: Description fields now require meaningful long-form text, so Workday and Activate snippets stay as summaries only. The UI renders 26 expanders instead of 54 and shows only the text after the visible summary prefix. Verified no exact duplicate descriptions in the feed, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and a mobile Playwright DOM check with no horizontal overflow.

## Pay Range Extraction

- [x] Add text-based annual pay range extraction from provider descriptions.
- [x] Wire extraction as a fallback across all refreshed jobs.
- [x] Refresh the feed and verify salary coverage.
- [x] Run typecheck, lint, build, and diff hygiene.

Result: Added conservative annual salary extraction during refresh. Regenerated feed has 54 jobs, 26 meaningful descriptions, and 16 salary ranges with no invalid bounds found. Verified `npm run jobs:refresh`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Salary Range Filter

- [x] Add salary-range-only filter state and behavior.
- [x] Add a hero search-strip button for salary-visible jobs.
- [x] Verify counts, reset behavior, typecheck, lint, build, and diff hygiene.

Result: Added a `Salary shown` toggle beside Remote. It filters to jobs with parsed salary min/max ranges and currently shows 16 matching listings. Verified `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and a mobile browser click test.

## Publish Salary Work

- [x] Run final verification.
- [x] Commit and push salary extraction/filter changes.
- [x] Trigger the job refresh GitHub Action.
- [x] Deploy production to Vercel and verify.

Result: Pushed `1d1cca2`, triggered Refresh job listings run 27504335404 successfully, fast-forwarded to action commit `ed930ea`, and deployed production to https://endpointjobs.dev with HTTP 200 verification.

## README Screenshots And Feedback Button

- [x] Add a GitHub Issues button to the live page.
- [x] Capture desktop and mobile screenshots for the README.
- [x] Document how the page works and how job data is populated.
- [x] Run typecheck, lint, build, browser checks, and diff hygiene.

Result: Added a topbar GitHub Issues link, README screenshots, page behavior overview, and data population flow. Verified screenshot files, accessible mobile link label, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## React Doctor Top 3 Fixes

- [x] Confirm React Doctor CI/install state.
- [x] Read diagnostics and canonical no-cache rule docs.
- [x] Hoist repeated Intl date formatters.
- [x] Split JobBoard into smaller components.
- [x] Replace related filter useState calls with a reducer.
- [x] Re-run React Doctor and project gates.

Result: Installed React Doctor locally, confirmed existing PR/push CI workflow, hoisted static date formatters, split JobBoard into focused UI sections, and moved related filter/search/sort state into a reducer. Verified `npx react-doctor@latest --verbose` reports no issues and 100/100; `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and a mobile browser smoke test passed.


## Thermo-Nuclear React Doctor Follow-up

- [x] Audit current branch changes for structural maintainability findings.
- [x] Split JobBoard orchestration from filter model and section components.
- [x] Remove cast-heavy select handling from UI code.
- [x] Re-run React Doctor, typecheck, lint, build, diff hygiene, and browser smoke checks.

Result: Fixed the structural follow-up from the React Doctor pass. The top-level JobBoard client file is now a 63-line orchestration shell; filter state, typed parsing, controls, result rendering, topbar/footer, animated counters, and job cards live in focused modules. Verified `npx react-doctor@latest --verbose`, `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and a mobile browser smoke test.

## Edge Tools Compatibility Diagnostics

- [x] Add Safari-compatible prefixed backdrop filters.
- [x] Fix external-link rel attributes and static ARIA diagnostics.
- [x] Replace unsupported mobile CSS patterns and add standard line-clamp.
- [x] Run typecheck, lint, build, React Doctor, diff hygiene, and browser smoke checks.

Result: Added `-webkit-backdrop-filter`, `noopener noreferrer`, literal `aria-pressed` toggle branches, standard `line-clamp`, and Firefox-safe mobile min-height values. Removed unsupported `scrollbar-width`. Verified `npm run typecheck`, `npm run lint`, `npm run build`, `npx react-doctor@latest --verbose`, `git diff --check`, and a mobile browser smoke test.

## Thermo-Nuclear Compatibility Cleanup

- [x] Collapse duplicated literal ARIA toggle branches into one shared component.
- [x] Centralize glass backdrop-filter compatibility CSS.
- [x] Re-run React Doctor, typecheck, lint, build, diff hygiene, and browser smoke checks.

Result: Centralized the Edge-compatible literal `aria-pressed` branch in `ToggleButton` and replaced repeated glass blur declarations with one shared CSS selector group. Verified `npm run typecheck`, `npm run lint`, `npx react-doctor@latest --verbose`, `npm run build`, `git diff --check`, and a mobile browser smoke test.

## Publish React Doctor And Diagnostics Work

- [x] Run final local verification.
- [x] Commit and push current changes to GitHub.
- [x] Trigger the job refresh GitHub Action and check result.
- [x] Deploy production to Vercel and verify live response.

Result: Verified typecheck, lint, React Doctor, diff hygiene, and production build; pushed `712bbc6`; triggered Refresh job listings run `27508084649`, which succeeded and wrote 54 jobs from 12 providers in action commit `f25fe7a`; deployed production to `https://endpointjobs.dev` and verified HTTP 200. Action logs still show env-gated providers skipped until their GitHub secrets are configured: Workable, Techmap RSS, Adzuna, TheirStack, and SerpAPI.

## Obsidian Parallax Background

- [x] Add a parallax pixel background using the site's obsidian, lime, and emerald palette.
- [x] Keep the job-board UI readable and interactive above the background layers.
- [x] Respect reduced-motion users and mobile performance.
- [x] Verify typecheck, lint, build, and responsive browser rendering.

Result: Added inert parallax layers behind the job board with lime, emerald, and white pixel fields, a 60px grid atmosphere, reduced-motion handling, and softer mobile opacity. Verified npm run typecheck, npm run lint, git diff --check, npm run build, and browser desktop/mobile snapshots; dev-only HMR warnings were due to 127.0.0.1 origin blocking and do not affect production.

## GitHub Issue Template

- [x] Add a GitHub issue form for bug reports, stale listings, missing sources, and feature requests.
- [x] Keep blank issues available and link back to the live site.
- [x] Validate YAML syntax and diff hygiene.

Result: Added .github/ISSUE_TEMPLATE/report-or-request.yml and config.yml. Verified both files parse as YAML and git diff --check passes.

## Thermo-Nuclear Current Branch Fixes

- [x] Review current uncommitted branch changes for structural regressions.
- [x] Fix any file-size, spaghetti, abstraction, or boundary findings.
- [x] Re-run validation and line-count checks.

Result: Found and fixed one structural blocker: the parallax change pushed src/app/job-board.css to 1,014 lines. Decomposed the background into src/app/parallax-background.css and src/components/job-board/parallax-background.tsx, added one site-content stacking wrapper, removed stale per-section z-index selectors, and pointed the feedback link directly at the new issue form. Verified typecheck, lint, YAML parsing, build, diff hygiene, line counts, and desktop/mobile browser snapshots.

## Publish Parallax And Issue Template Work

- [x] Run final local verification.
- [x] Commit and push current changes to GitHub.
- [x] Trigger the job refresh GitHub Action and check result.
- [x] Deploy production to Vercel and verify live response.

Result: Verified typecheck, lint, YAML parsing, diff hygiene, file-size line counts, and production build; pushed implementation commit 790b2b5; triggered Refresh job listings run 27509038208, which succeeded and wrote 54 jobs from 12 providers in action commit b7e4f0b; deployed production to https://endpointjobs.dev and verified HTTP 200. Action logs still show env-gated providers skipped until their GitHub secrets/config are set: Workable, Techmap RSS, Adzuna, TheirStack, and SerpAPI.

## High-Signal Company Source Expansion

- [x] Add verified Greenhouse boards for Databricks, Zscaler, Samsara, Scale AI, and Wiz.
- [x] Add verified Ashby boards for Cursor, Perplexity, OpenAI, Cohere, ElevenLabs, and Watershed.
- [x] Keep GitHub Action env and local refresh defaults aligned.
- [x] Refresh jobs and verify local quality gates.

Result: Added high-signal public ATS sources to local defaults and GitHub Actions. Refresh fetched the new boards successfully and wrote 61 endpoint jobs from 12 providers, with accepted new-company roles from Zscaler, Samsara, Databricks, Scale AI, Wiz, and Cursor. Verified duplicate IDs, typecheck, lint, build, and diff hygiene.

## Second-Batch Company Source Expansion

- [x] Add Greenhouse boards for Stripe, Robinhood, Box, Datadog, Elastic, Lyft, and Instacart.
- [x] Keep GitHub Action env and local refresh defaults aligned.
- [x] Update provider docs and display-name mapping.
- [x] Refresh jobs and verify local quality gates.

Result: Added second-batch Greenhouse boards for Stripe, Robinhood, Box, Datadog, Elastic, Lyft, and Instacart. Refresh fetched all seven successfully, increasing Greenhouse raw scan volume to 5,534 jobs; none produced endpoint-qualified accepted listings in this run, so the feed remained at 61 jobs from 12 providers.

## Publish Company Source Expansion

- [x] Run final local verification before publishing.
- [x] Commit source expansion and refreshed feed.
- [x] Push main to GitHub.
- [x] Deploy production to Vercel and verify endpointjobs.dev.

Result: Published source expansion commit 89c84bc to GitHub main, deployed Vercel production deployment dpl_5csPEMK99vqrJzv3XzuQoDWTaxWV, aliased it to https://endpointjobs.dev, and verified the live domain returned HTTP 200 with the Endpoint Jobs page content.

## Footer Links And Description Formatting

- [x] Move the issue/report action out of the topbar and into the page footer.
- [x] Add footer credit and GitHub repository link.
- [x] Preserve readable line breaks in stored/rendered long job descriptions.
- [x] Refresh job data and verify quality gates.

Result: Moved the report/request action to the footer, added Made by Jorgeasaurus and a GitHub repo link, preserved paragraph/list breaks during description normalization, and rendered expanded descriptions as separate text blocks. Refreshed feed has 61 jobs, 33 descriptions, and 32 multiline descriptions. Verified jobs refresh, typecheck, lint, build, duplicate IDs, diff hygiene, and browser DOM behavior.

## Publish Footer And Description Formatting

- [x] Run final local verification before publishing.
- [x] Commit footer and description formatting changes.
- [x] Push main to GitHub.
- [x] Deploy production to Vercel and verify endpointjobs.dev.

Result: Published footer and description formatting commit fa3893b to GitHub main, deployed Vercel production deployment dpl_2HEpjSqp1u5iyHaxWTzFv2NW2UJz, aliased it to https://endpointjobs.dev, and verified the live domain returned HTTP 200 with the Made by Jorgeasaurus footer content.

## Provider Secret Verification

- [x] Trigger the Refresh job listings workflow.
- [x] Inspect provider logs for Adzuna, TheirStack, and SerpAPI.
- [x] Fix SerpAPI duplicate feed IDs and TheirStack page limit.
- [x] Re-run the workflow and verify provider counts.
- [x] Fast-forward local listings if the workflow commits refreshed jobs.

Result: Initial run 27514957148 proved Adzuna and SerpAPI credentials are accepted, but failed because SerpAPI returned duplicate aggregator IDs. TheirStack authenticated but rejected the configured 100-result page size; current plan allows 25. Local mock verification confirmed duplicate SerpAPI job IDs now produce unique stable feed IDs. Rerun 27515140411 succeeded, wrote 80 endpoint jobs from 15 successful providers, and action commit 61b8279 was fast-forwarded locally. Raw API checks included Adzuna 300, TheirStack 25, and SerpAPI 107; accepted feed counts are SerpAPI 44, Adzuna 18, TheirStack 7, Greenhouse 5, Workday 4, and Activate 2.

## Vercel Analytics

- [x] Confirm current Vercel Analytics App Router integration.
- [x] Install `@vercel/analytics`.
- [x] Render the Analytics component in the root layout.
- [x] Verify typecheck, lint, build, and diff hygiene.
- [x] Commit and push the change.

Result: Added Vercel Web Analytics using the official `@vercel/analytics/next` App Router component. Verified `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`; pushed commit `b6cce31`.

## README Screenshot Refresh

- [x] Inspect current README screenshot references.
- [x] Capture fresh desktop and mobile screenshots from the current app.
- [x] Replace README screenshot assets without changing public paths.
- [x] Verify image files, README references, and diff hygiene.
- [x] Commit and push refreshed screenshots.

Result: Refreshed `docs/screenshots/readme-desktop.png` and `docs/screenshots/readme-mobile.png` from the current production page at 1440x1200 and 390x1200. Verified README paths, image dimensions, and `git diff --check`.

## SEO Optimization

- [x] Inspect current metadata, page structure, and public assets.
- [x] Add canonical metadata, Open Graph, Twitter, robots, sitemap, and JSON-LD.
- [x] Add a public Open Graph image.
- [x] Verify generated metadata routes, HTML tags, typecheck, lint, build, and diff hygiene.
- [x] Commit and push SEO optimization.

Result: Added enriched root metadata, canonical URL, Open Graph and Twitter cards, `public/og-image.png`, `robots.txt`, `sitemap.xml`, and safe WebSite/Organization/CollectionPage JSON-LD. Verified `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`, and local HTTP responses for `/`, `/robots.txt`, `/sitemap.xml`, and `/og-image.png`.

## Thermo-Nuclear Current Site Review

- [x] Audit current source for structural regressions, oversized modules, scattered special cases, and unclear data boundaries.
- [x] Fix the highest-confidence findings without changing user-facing behavior.
- [x] Re-run typecheck, lint, build, React Doctor, diff hygiene, and targeted route checks.
- [x] Document results.

Result: Fixed route-level SEO metadata leakage by moving robots directives from the root layout to the home page, converted JSON-LD to a single graph object rendered without raw HTML injection, and moved expanded-description filtering out of the job card into the job utility layer. Verified React Doctor 100/100, typecheck, lint, production build, diff hygiene, line counts, homepage/not-found robots output, and JSON-LD parsing.

## Publish Thermo-Nuclear Review Fixes

- [x] Commit and push current review fixes to GitHub.
- [x] Deploy production to Vercel and verify endpointjobs.dev.
- [x] Trigger the Refresh job listings workflow and inspect the result.
- [x] Document the publish result.

Result: Pushed review commit `bd9cd4e`, deployed production deployment `dpl_Bm6GRf9XGE7C61FPcRdVWqRy48ac`, and verified https://endpointjobs.dev returned HTTP 200 with parsable JSON-LD. Triggered Refresh job listings run `27516857041`, which succeeded and pushed action commit `c3a74fa` with 80 endpoint jobs from 15 providers. Workable and Techmap RSS were skipped because their account/feed configuration is still empty.

## UX/UI Improvement Loop 1

- [x] Create and work from the `dev` branch.
- [x] Add shareable URL-backed filters and `/` search focus.
- [x] Add active filter chips and search-term highlighting inside listings.
- [x] Improve mobile filter ergonomics without disrupting the current glass aesthetic.
- [x] Verify typecheck, lint, build, React Doctor, diff hygiene, and desktop/mobile rendering.

Result: Created `dev`, added URL-restored filters with shareable query params, `/` search focus, active removable filter chips, and highlighted search matches in listings. Verified `npm run typecheck`, `npm run lint`, `npm run build`, `npm run doctor -- --verbose` at 100/100, `git diff --check`, and Playwright desktop/mobile checks for URL restoration, highlights, chip scrolling, and no horizontal overflow.

## UX/UI Loop 1 Review Fixes

- [x] Replace duplicated active-filter conditions with one canonical active-filter item model.
- [x] Preserve unrelated URL query params while syncing known job-board filter params.
- [x] Extract URL sync and search-focus browser effects out of `JobBoard`.
- [x] Verify typecheck, lint, build, React Doctor, diff hygiene, and desktop/mobile URL behavior.

Result: Reworked filters so the URL is the canonical external store, dispatch writes known filter params while preserving unrelated params, active chips/counts derive from one `getActiveFilterItems` model, and `JobBoard` delegates URL sync plus search-focus behavior to focused hooks. Verified typecheck, lint, production build, React Doctor 100/100, diff hygiene, and Chromium checks for sort-only chips, UTM preservation, `/` focus, dense chips, and mobile no-overflow behavior.

## Publish Dev Preview

- [ ] Run final local verification before publishing.
- [ ] Commit UX loop and review-fix changes on `dev`.
- [ ] Push `dev` to GitHub.
- [ ] Create a Vercel preview deployment and verify it is ready.

## RapidAPI And Broader Company Monitoring

- [x] Add broader Endpoint/UEM/security/productivity companies to TheirStack and SerpAPI monitoring.
- [x] Add missing endpoint-adjacent search terms to relevance and query defaults.
- [x] Add RapidAPI Daily International Job Postings as an env-gated provider.
- [x] Wire GitHub Actions and README docs without committing API keys.
- [x] Verify provider behavior, typecheck, lint, build, React Doctor, and diff hygiene.

Result: Added centralized endpoint search/company monitoring defaults, wired them into TheirStack and SerpAPI, added an env-gated RapidAPI Daily International Jobs provider, configured the GitHub Actions secret name, and documented setup. Verified RapidAPI with a local mock refresh and a real HTTP 200 key check; typecheck, lint, React Doctor, build, YAML parsing, and secret hygiene passed.

## SerpAPI No-Results Resilience

- [x] Inspect the refresh action behavior after broader company query rollout.
- [x] Treat SerpAPI no-result query errors as empty query pages instead of provider failures.
- [x] Verify with a local SerpAPI mock containing one no-result query and one valid endpoint job.
- [x] Re-run typecheck, lint, React Doctor, build, diff hygiene, and the GitHub Action.

## Thermo-Nuclear Dev Branch Cleanup

- [x] Remove duplicated provider query lists from the GitHub Action and keep defaults in code.
- [x] Move Adzuna onto the shared endpoint search configuration.
- [x] Decompose `filter-model.ts` so URL serialization and active chip modeling live in focused modules.
- [x] Make TheirStack page fetching return results instead of mutating a shared accumulator.
- [x] Consolidate repeated provider employment-type normalization in the shared refresh layer.
- [x] Re-run typecheck, lint, React Doctor, build, diff hygiene, and targeted behavior checks.

Result: Removed workflow-owned query duplicates, centralized employment normalization, split URL/chip filter modules, returned TheirStack pages as arrays, stripped Adzuna tracking IDs, and verified typecheck, lint, React Doctor, build, and hygiene checks.

## Mobile First View Optimization

- [x] Shorten the mobile hero and search controls so listings begin sooner.
- [x] Put advanced seniority/sort/tools filters behind a mobile-only drawer.
- [x] Highlight salary ranges with a dedicated compensation pill when present.
- [x] Keep desktop filter stack behavior unchanged.
- [x] Verify mobile overflow, lint, typecheck, and build.

Result: Mobile now shows the results panel around 447px and the first job around 524px at 390px width, salary ranges render as dedicated lime compensation pills, and there is no document-level horizontal overflow.

## Greentube Curated Job Addition

- [x] Add a curated job URL provider so handpicked jobs survive refreshes.
- [x] Include the Greentube EUC Engineer Endpoint Management listing.
- [x] Refresh the feed and verify the Greentube job appears.
- [x] Run typecheck, lint, build, and diff checks.

Result: Added a default `curated` provider for the Greentube EUC Engineer Endpoint Management page, preserved the existing 80-job feed mix, and verified Greentube appears with Hybrid/Vienna metadata, EUR 60k salary, Intune/Autopilot tooling, and bullet-preserved description text. Verified `npm run jobs:refresh` with `JOB_PROVIDERS=curated`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Thermo-Nuclear Review: Greentube Addition

- [x] Audit the current curated-provider diff for structural regressions.
- [x] Replace brittle or over-generic code with a simpler canonical shape.
- [x] Verify the Greentube job still appears with salary and multiline description.
- [x] Run typecheck, lint, build, refresh, and diff checks.

Result: Replaced the brittle generic HTML page scraper with an explicit curated job provider that still uses the canonical `toEndpointJob` normalizer. Narrowed feed-cap reservation to `Curated Jobs`, kept the salary-shown filter aligned with its label, and verified Greentube remains present with Hybrid/Vienna metadata, EUR 60k salary, and multiline bullets. Verified `JOB_PROVIDERS=curated npm run jobs:refresh`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Curated Listing Availability Check

- [x] Add a conservative availability check for curated job source URLs.
- [x] Verify unavailable listings are excluded only on strong evidence.
- [x] Verify the current Greentube listing still appears while available.
- [x] Run typecheck, lint, build, refresh, and diff checks.

Result: Curated jobs now fetch the source page during refresh and are removed only for strong unavailable evidence: HTTP 404/410, explicit closed-job text, or missing required page markers. Transient network, timeout, 429, or 5xx failures keep the curated job and log a warning. Verified Greentube still appears from `JOB_PROVIDERS=curated npm run jobs:refresh`, plus `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Thermo-Nuclear Review: Curated Availability

- [x] Audit the curated availability implementation for structural regressions.
- [x] Address findings with simpler boundaries and less provider-level complexity.
- [x] Verify the Greentube curated listing still passes availability while active.
- [x] Run typecheck, lint, build, refresh, and diff checks.

Result: Removed provider-specific feed reservation from refresh orchestration by adding `reserveFeedSlots` to the provider contract and reserving by normalized job ID. Tightened curated availability matching to require stable identity markers only and removed over-broad soft-404 text phrases. Verified `JOB_PROVIDERS=curated npm run jobs:refresh`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

## Push Dev And Vercel Preview

- [x] Review final working tree status.
- [x] Commit curated job and availability changes on `dev`.
- [x] Push `dev` to GitHub.
- [x] Create and inspect a Vercel preview deployment.

Result: Pushed the curated job availability work to `dev` and created a Ready Vercel preview deployment. Direct unauthenticated HTTP requests return Vercel Deployment Protection `401`, so preview access may require Vercel auth or a bypass configuration.

## Job Pagination

- [x] Inspect current job filtering and results rendering.
- [x] Add client-side pagination for filtered jobs.
- [x] Reset pagination when filters change.
- [x] Verify typecheck, lint, build, and rendered behavior.

Result: Added 20-job client-side pagination above and below the filtered result list, with previous/next controls, page numbers, filtered-count summaries, and page reset on filter changes. Verified typecheck, lint, build, React Doctor, diff hygiene, line counts, desktop page navigation, filter reset, and 390px mobile no-overflow behavior.

## Push Pagination Preview

- [x] Confirm Vercel project link and local diff scope.
- [x] Run final deploy hygiene checks.
- [x] Create a Vercel preview deployment.
- [x] Inspect preview deployment status.

Result: Created Ready preview deployment `dpl_GP6SCB6PrPy6rWyqdcLpZiTrt5q1` at `https://endpoint-jobs-kurict8w6-jorgeasaurus-projects.vercel.app`. Verified with `vercel inspect` and `vercel curl / --deployment`.

## Refreshed Feed Preview Deployment

- [x] Confirm refreshed branch and feed state.
- [x] Run local production build.
- [x] Create a Vercel preview deployment.
- [x] Inspect and curl the preview deployment.

Result: Deployed refreshed branch commit `f33b63c` to Vercel preview `dpl_DXmSr5VAjaRsREf3HX8tHoFu1ep6` at `https://endpoint-jobs-qklpfz684-jorgeasaurus-projects.vercel.app`. Verified Ready status with `vercel inspect` and captured the protected preview HTML with `vercel curl`.

## Adzuna Description Parsing Fix

- [x] Trace Adzuna descriptions from provider normalization to expanded card rendering.
- [x] Fix the description/summary boundary without Adzuna-specific UI hacks.
- [x] Refresh or repair affected job data.
- [x] Verify build, lint, typecheck, and rendered Adzuna cards.

Result: Summary and description normalization now trim to word boundaries, and expanded card prefix removal guards against stale mid-word summaries. Repaired generated summaries for the current 200-job feed; verified typecheck, lint, build, diff hygiene, feed-wide expanded-description boundaries, and the rendered Accenture Adzuna card.

## Push Adzuna Fix Preview

- [x] Review final diff scope.
- [x] Run final build hygiene checks.
- [x] Commit and push the current branch.
- [x] Create and inspect a Vercel preview deployment.

Result: Pushed `00196b1` to `codex/linkedin-api-client-spike` and created Ready Vercel preview `dpl_7zm3h6KtnjmopgX655h7DMqfvXGW` at `https://endpoint-jobs-2zb77oy2n-jorgeasaurus-projects.vercel.app`. Verified with `vercel inspect`, `vercel curl / --deployment`, and a protected preview query containing `Top 50 Companies` without the broken `op 50 Companies` fragment.

## Refresh Action Push Rejection

- [x] Inspect failed GitHub Actions job logs.
- [x] Fix stale-branch handling in the listing commit step.
- [x] Verify workflow syntax and local build hygiene.
- [x] Commit, push, dispatch the workflow, and inspect the result.

Result: Failed run `27623925107` refreshed and built successfully, then failed because `git push` was rejected after the branch advanced. Added fetch/rebase before pushing generated listings, pushed `852aaf1`, and dispatched run `27624311110`, which succeeded and pushed refresh commit `b93d605` with 300 jobs. Verified refreshed feed locally: `staleSummaries=0`, `midWordExpandedStarts=0`.

## Merge Branch To Production

- [x] Sync local `main` with origin.
- [x] Merge `codex/linkedin-api-client-spike` into `main`.
- [x] Verify typecheck, lint, build, and feed description boundaries.
- [x] Push `main` to GitHub.
- [x] Deploy Vercel production and verify `endpointjobs.dev`.

Result: Merged the branch into `main`, resolved the generated feed conflict by keeping the refreshed 300-job branch feed, pushed `main`, deployed production, and verified `endpointjobs.dev` renders the updated job board with clean Adzuna description boundaries.

## Adzuna Description Cutoff Investigation

- [x] Measure current Adzuna description lengths and truncation markers.
- [x] Trace provider normalization and UI expansion boundaries.
- [x] Identify whether cutoff is API-provided or locally imposed.
- [x] Patch the narrow root cause if local.
- [x] Verify feed data, build, and rendered descriptions.

Result: Adzuna's API only returns description snippets, so the refresh no longer stores Adzuna `description` values as expandable full text. Repaired the current feed by keeping Adzuna summaries while removing 229 persisted snippet descriptions; verified typecheck, lint, React Doctor, diff hygiene, feed assertions for the card render condition, and a webpack production build. Local Turbopack build hung twice at compile, so webpack was used for build verification.

## Push Adzuna Snippet Fix To Dev

- [x] Fast-forward `dev` to current `main`.
- [x] Commit the Adzuna snippet fix on `dev`.
- [ ] Push `dev` to GitHub.
- [ ] Dispatch the refresh workflow against `dev`.
- [ ] Check the workflow run status.

## Greenhouse Board Expansion

- [x] Identify high-signal Greenhouse boards for endpoint-adjacent companies.
- [x] Verify each board slug against the Greenhouse jobs API.
- [x] Keep GitHub Action and local defaults aligned.
- [x] Run refresh and build quality gates.

Result: Added verified Greenhouse boards for Anduril, Asana, MongoDB, Brex, Figma, Airbnb, Discord, Reddit, Rubrik, Dropbox, Affirm, and Duolingo. Focused Greenhouse refresh fetched 9,350 raw jobs and wrote 37 endpoint-filtered jobs, including six new matches from Anduril and Asana; duplicate job IDs were zero. Verified typecheck, lint, workflow YAML parsing, build, and diff hygiene.

## Push Branch And Run Refresh Action

- [x] Review final diff scope.
- [ ] Commit current intended changes.
- [ ] Push the current branch to GitHub.
- [ ] Dispatch `Refresh job listings` against the branch.
- [ ] Inspect the workflow result.

## Feature User Story Audit

- [x] Inventory app features from code.
- [x] Create canonical feature/user-story spreadsheet at `docs/feature-user-stories.csv`.
- [x] Test every user story and document errors in the spreadsheet.
- [x] Fix every logistical or UX error found during testing.
- [x] Retest every user behavior post-fix and update the spreadsheet.

Result: Documented 56 implemented features/user behaviors in docs/feature-user-stories.csv. First audit pass ran typecheck, lint, build, model/static-route checks, and browser viewport checks. FEAT-028 initially failed because 99 active feed rows had empty stored matchReasons; fixed with frontend display fallbacks and future normalizer fallbacks. Post-fix retest: 56 passed, 0 remaining failures. Added reusable browser audit command `npm run audit:browser` for the viewport/interaction subset.

## Scroll Performance Investigation

- [x] Profile baseline mobile and desktop job-list scrolling.
- [x] Isolate paint/compositing causes with CSS effect toggles.
- [x] Remove live blur/animation cost from scrolling surfaces while keeping visual style.
- [x] Retest browser behavior, mobile overflow, scroll profile, typecheck, lint, and build.

Result: Scroll jank was paint/compositing from stacked backdrop-filter surfaces, animated fixed star layers, and large fixed blurred glow pseudo-elements. Post-fix profile improved mobile p95 frame gap from ~43ms to ~9ms and desktop p95 from ~142ms to ~25ms, with zero >50ms frames. Browser audit, typecheck, lint, and build pass.

## Adzuna Summary Snippet Cleanup

- [x] Confirm Adzuna description behavior against provider docs and local feed.
- [x] Stop rendering Adzuna snippets as cut-off descriptions.
- [x] Repair existing generated Adzuna rows.
- [x] Verify feed assertions, typecheck, lint, and build.

Result: Adzuna's Search API documents description as snippet-only, so Adzuna cards now render a structured listing preview instead of a clipped snippet. Existing feed repaired: 214 Adzuna rows, 0 stored descriptions, 0 ellipsis-ended summaries. Verified mocked Adzuna adapter behavior, feed assertions, typecheck, lint, and build.

## Three.js Job Map

- [x] Inspect current job-board state, data shape, and styling.
- [x] Add Three.js dependency and map component.
- [x] Resolve job locations to map points with conservative fallbacks.
- [x] Wire map to filtered jobs with hover detail and apply link.
- [x] Verify build plus desktop/mobile canvas rendering.

Result: Added a Three.js job geography band synced to filtered listings. Current feed maps 209 of 287 jobs into 39 markets; broad locations use region centroids and unresolved multi-location rows are skipped. Hover/tap cards show title, company, salary, and apply links. Verified typecheck, lint, build, desktop/mobile screenshots, nonblank canvas pixels, animation deltas, tooltip apply links, and no horizontal overflow.

## LinkedIn Screenshot Job Additions

- [x] Parse pasted candidate list and compare against current feed.
- [x] Verify public employer/ATS URLs for each candidate.
- [x] Add verified source coverage only.
- [x] Refresh or assert feed additions.
- [x] Run typecheck, lint, build, and focused feed checks.

Result: Added 7 source-pulled jobs only: F5 Senior MDM Engineer, Allstate Exposure Intelligence Analyst - Endpoint & Identity, Gartner Senior Systems Engineer (Windows Endpoint Mangement), Nordic Consulting MDM Engineer III, SHI Presales Solutions Engineer - endpoint Security, Circle Senior Manager Endpoint & Trusted Environments, and Perplexity Senior IT Systems Administrator. Sources are Workday or Ashby; no manual/curated rows were added. Skipped the remaining pasted rows unless an existing adapter-compatible source produced an accepted endpoint row. Verified focused feed assertions, map coverage, typecheck, lint, build, and browser search for F5.

## Playwright Map Framing Fix

- [x] Capture current map screenshots and Playwright diagnostics.
- [x] Fix map framing and point readability.
- [x] Re-run desktop/mobile Playwright checks.
- [x] Run typecheck, lint, and build.

Result: Playwright showed the original world plane was too small inside the canvas, leaving excess empty space and compressing job points into a tight cluster. Replaced fixed global projection with responsive weighted market bounds, aspect-aware map texture rendering, and per-resize point projection. Verified desktop/mobile screenshots, nonblank canvas pixels, animation deltas, tooltip apply links, zero horizontal overflow, typecheck, lint, and build.

## Distribution Map Reference Styling

- [x] Review the pasted reference and current Three.js map.
- [x] Apply dark/cyan distribution-map marker and hover treatment.
- [x] Verify typecheck, lint, build, and browser rendering.
- [x] Document final result.

Result: Restyled the Three.js job map toward the pasted distribution-map reference with a dark map field, cyan ring markers, and a compact 300x220 hover panel showing title, company, salary, and apply links. Verified `npm run typecheck`, `npm run lint`, `npm run build`, and Playwright desktop/mobile screenshots with canvas-region pixel checks, animation deltas, tooltip bounds, apply links, and zero horizontal overflow.

## Recognizable World Map Repair

- [x] Record the correction and inspect why the current map reads abstract.
- [x] Replace rough hand-drawn land polygons with recognizable world geography.
- [x] Keep job markers and hover cards usable on desktop and mobile.
- [x] Verify typecheck, lint, build, and Playwright rendering.
- [x] Document final result.

Result: Replaced the hand-drawn pseudo-continent polygons with bundled `world-atlas` country geometry rendered through the existing Three.js canvas texture. Switched the map to a fixed global extent with aspect-preserving projection, clipped land geometry at the frame instead of clamping it, and reduced marker sizes so North America stays legible. Verified typecheck, lint, build, and Playwright desktop/mobile screenshots with world-land pixels, marker pixels, animation deltas, tooltip bounds, apply links, and zero horizontal overflow.

## Per-Job Zoomed Map

- [x] Review current market aggregation and world-map projection.
- [x] Render each mapped job as its own point.
- [x] Zoom the map bounds to the active mapped jobs.
- [x] Verify typecheck, lint, build, and Playwright rendering.
- [x] Document final result.

Result: Changed map markers from grouped markets to one marker per mapped job, with deterministic offsets around shared locations so same-city jobs are individually hoverable. Map bounds now fit the active mapped jobs instead of the full world, and hover cards show one job with title, company, salary, and apply link. Verified typecheck, lint, build, and Playwright desktop/mobile screenshots with marker pixels, animation deltas, one-job tooltip assertions, tooltip bounds, apply links, and zero horizontal overflow.

## Map Zoom And Palette Match

- [x] Review current map interaction and color implementation.
- [x] Add zoom controls and wheel zoom.
- [x] Match map colors to the page lime/emerald palette.
- [x] Verify typecheck, lint, build, and Playwright rendering.
- [x] Document final result.

Result: Added icon zoom controls, wheel zoom centered on the pointer, reset, percentage readout, and drag panning while zoomed. Updated the map canvas, markers, tooltip, controls, and grid colors to use the page's lime/emerald/glass palette. Verified typecheck, lint, build, and Playwright desktop/mobile checks for zoom controls, wheel zoom, palette pixels, tooltip bounds, apply links, and zero horizontal overflow.

## Vercel Preview Deployment

- [x] Create preview deployment from the current working tree.
- [x] Inspect the deployment until Vercel reports a final state.
- [x] Verify the preview responds through Vercel.
- [x] Document preview URL and result.

Result: Created Vercel preview `dpl_5DD1SHko1dd6WUwB3HTQrE6T7iSy` at https://endpoint-jobs-42ukrvjlz-jorgeasaurus-projects.vercel.app. `vercel inspect --wait` reported preview status Ready, and authenticated `vercel curl -I` returned HTTP/2 200. Direct public access redirects to Vercel SSO because preview protection is enabled.

## Full Page UI/UX Map Review

- [x] Audit current desktop and mobile experience with the `ui-ux-pro-max` checklist.
- [x] Identify map zoom, hit target, tooltip, and mobile layout failures.
- [x] Implement focused map and mobile UX fixes.
- [x] Verify with Playwright screenshots, typecheck, lint, and build.
- [x] Document review findings and result.

Result: UI/UX review found the map maxed out at 360%, zoom controls focused the geographic midpoint instead of the dense job cluster, map controls were 28-30px on mobile/desktop, touch taps did not reliably open job details, and landscape mobile kept a 460px map inside a 375px viewport. Raised map zoom to 1200%, made button zoom focus the median job cluster, added constant 44px hit targets, reduced marker growth at high zoom, made mobile tooltips render as an in-bounds sheet with apply link, expanded controls to 44px, and shortened landscape map height. Verified Playwright screenshots/assertions across desktop, 390px mobile, 375px mobile, and 812x375 landscape, plus typecheck, lint, and build.

## Vercel Preview Deployment - Map UX Fixes

- [x] Create preview deployment from the current working tree.
- [x] Inspect the deployment until Vercel reports a final state.
- [x] Verify the protected preview responds through Vercel.
- [x] Document preview URL and result.

Result: Created Vercel preview `dpl_7RD7fs93EFphh7iMEdnr316jovrD` at https://endpoint-jobs-ioie13sz0-jorgeasaurus-projects.vercel.app. `vercel inspect --wait` reported preview status Ready, and authenticated `vercel curl -I` returned HTTP/2 200. Direct public access redirects to Vercel SSO because preview protection is enabled.

## Map Offshore Point Correction

- [x] Confirm why zoomed coastal jobs appear offshore.
- [x] Keep per-job scatter offsets stable while the map zooms.
- [x] Verify zoomed mobile map and tooltip behavior with Playwright.
- [x] Run typecheck, lint, and build.
- [x] Document result.

Result: The offshore points were caused by per-job scatter offsets being added inside the zoomed Three.js map group, so the artificial separation scaled up with map zoom. Job anchors now stay at their true projected coordinates while only the scatter offset is divided by current zoom, keeping separation readable without pushing coastal jobs into the ocean. Verified Playwright screenshots/assertions at 759% and 1200% zoom across desktop, 390px mobile, 375px mobile, and 812x375 landscape, plus mobile tooltip/apply-link behavior. `npm run lint`, `npm run build`, and a post-build `npm run typecheck` pass.

## Vercel Preview Deployment - Offshore Map Fix

- [x] Create preview deployment from the offshore point fix.
- [x] Inspect the deployment until Vercel reports a final state.
- [x] Verify the protected preview responds through Vercel.
- [x] Document preview URL and result.

Result: Created Vercel preview `dpl_FHk6UqBbQog8L9LxNrrcfYAYyXag` at https://endpoint-jobs-fofvvpgrx-jorgeasaurus-projects.vercel.app. `vercel inspect --wait` reported preview status Ready, authenticated `vercel curl -I` returned HTTP/2 200, and direct public access redirects to Vercel SSO because preview protection is enabled.

## Feature Story Coverage Update

- [x] Inspect current spreadsheet and audit coverage.
- [x] Add user stories for SpaceX source and Adzuna availability controls.
- [x] Add deterministic data audit for those stories.
- [x] Run story audits and app verification.
- [x] Document final result.

Result: Added FEAT-058 through FEAT-060 to `docs/feature-user-stories.csv` and added `npm run audit:data`. Verification passes: data audit 3/3, browser audit 13/13, typecheck, lint, build, diff whitespace, React Doctor 100/100, and spreadsheet count 60 rows.

## Feature Audit Coverage Expansion

- [x] Measure current direct audit coverage.
- [x] Add deterministic checks for pure filter, URL, card, feed, source, SEO, workflow, and map stories.
- [x] Split coarse map coverage into granular map user stories.
- [x] Run the expanded audit suite and build checks.
- [x] Update the canonical spreadsheet notes with current audit coverage.
- [x] Document remaining manual/browser-only gaps.

Result: Expanded the canonical tracker from 60 to 69 stories by adding granular map rows plus provider contract, endpoint search config, and map-location resolver rows. Automated coverage now references 69/69 stories: `npm run audit:data` passes 56 checks covering 55 feature rows plus tracker integrity, and `npm run audit:browser` passes 14 interaction stories including map zoom. Reverse source inventory reports 0 untracked app/refresh/workflow files. Verification passes typecheck, lint, build, diff whitespace, and React Doctor 100/100.

## Vercel Preview Deployment - Feature Audit Coverage

- [x] Create preview deployment from the current working tree.
- [x] Inspect the deployment until Vercel reports a final state.
- [x] Verify the protected preview responds through Vercel.
- [x] Document preview URL and result.

Result: Created Vercel preview `dpl_DbNMb11ce2QVhavzPE6B4nw3gtEi` at https://endpoint-jobs-dqpyyyp17-jorgeasaurus-projects.vercel.app. `vercel inspect --wait` reported preview status Ready, and authenticated `vercel curl -I` returned HTTP/2 200.
