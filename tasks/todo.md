# Job comparison view

- [x] Create an isolated feature branch.
- [x] Define comparison selection and display contracts.
- [x] Add accessible 2–4 job selection controls.
- [x] Build the responsive side-by-side comparison view.
- [x] Add focused tests for comparison behavior.
- [x] Run typecheck, lint, tests, build, and browser verification.
- [x] Run React Doctor and fix regressions.
- [x] Run thermonuclear review loops until clean.
- [x] Commit, push, and verify a Vercel preview.

## Review

Implemented an accessible comparison table with a tested four-role selection reducer and responsive horizontal containment. Typecheck, lint, build, 57 data checks, 30 browser checks, React Doctor 100/100, and three thermonuclear review passes completed; the final pass approved cleanly.

# Comparison categories header

- [x] Replace the corner Roles label with Categories in the top-left cell.
- [x] Preserve accessible table headers and responsive column sizing.
- [x] Verify mobile and desktop layout with Playwright.

## Review

Placed Categories in the top-left header cell beside the role headings. Lint, typecheck, production build, and Playwright checks at 390px and 1280px pass.

# Thermo-nuclear review remediation

- [x] Extract comparison styles and responsive rules into a feature-owned stylesheet.
- [x] Move comparison data and browser audits into focused modules.
- [x] Add static and browser assertions for the top-left Categories header.
- [x] Run full verification and repeat the strict review.

## Review

Extracted comparison CSS and audit coverage into focused modules, added permanent first-cell and keyboard-focus browser assertions, and restored an accessible named scroll region. Lint, typecheck, build, 57 data checks, 30 browser checks, React Doctor 100/100, and the final thermo-nuclear review pass.

# Issue 8: country-aware location filtering

- [x] Reproduce Switzerland returning no results for Zürich listings.
- [x] Include canonical mapped country labels in location search.
- [x] Add data and browser regression coverage.
- [x] Run full verification.

## Review

Location filtering now searches persisted map labels alongside raw provider locations and workplace values, so country and normalized city queries work without regressing unmapped jobs. Lint, typecheck, build, 58 data checks, 32 browser checks, and React Doctor 100/100 pass.

# Canonical feature audit expansion

- [x] Reconcile every canonical story ID with executable audit coverage.
- [x] Add missing stories for popular searches, live coverage metrics, and feed safety.
- [x] Correct stale location, SEO, source, curated-provider, comparison, pagination, and feedback contracts.
- [x] Add behavioral tests for feed validation, curated availability, structured-data limits, metrics, comparison recovery/persistence, pagination scrolling, and topbar feedback.
- [x] Rerun the complete data and browser behavior suites.

## Review

Canonical tracker now contains 73 sequential stories and all 73 IDs map to executable audits. Data audit passes 58 checks and the production browser audit passes 32 checks; this cycle found and fixed issue #8's country-filter mismatch and found no additional failing user behavior.

# Discover endpoint jobs from July 12 leads

- [x] Review pasted roles against endpoint relevance and existing feed coverage.
- [x] Resolve qualifying roles to live direct-employer postings.
- [x] Add minimal durable provider coverage or reviewed curated listings.
- [x] Refresh the feed and verify deduplication, URLs, data audits, and build.
- [x] Record sources, accepted roles, and verification results.

## Review

Added WHOOP Lever and Suno/Voleon Ashby coverage. The feed gained Suno's Senior IT Engineer; Dexcom and Brighton Jones were already present, WHOOP/Voleon were outside the 45-day direct-ATS freshness window, and Nordstrom was excluded after its search API returned 502. Typecheck, lint, 58 data audits, and production build pass with 406 listings.

# Discover endpoint jobs from second July 12 batch

- [x] Check the batch for existing listings and endpoint relevance.
- [x] Resolve qualifying roles to live direct-employer postings.
- [x] Add minimal durable source coverage.
- [x] Refresh targeted sources and merge accepted listings safely.
- [x] Run feed audits and production verification.

## Review

Added NinjaOne's remote Software Packaging Engineer from its live Jobvite posting with $120k-$150k compensation and Windows/macOS/Linux, PowerShell, SCCM, Intune, and RMM signals. Squint was absent from its official board; generic software, help-desk, and desktop-support roles were excluded. Typecheck, lint, 58 data audits, and production build pass with 407 unique listings.

# Thermo-nuclear review remediation: job discovery

- [x] Rebuild the generated feed with only the two intended additions.
- [x] Remove CI configuration that duplicates canonical provider defaults.
- [x] Remove the unverified Nordstrom Workday probe.
- [x] Run full verification and repeat the strict review.

## Review

Reduced the feed diff to the two intended records, made provider modules canonical for scheduled ATS defaults, and removed the failing Nordstrom probe. Typecheck, lint, 58 data audits, production build, diff checks, and the repeated thermo-nuclear review pass cleanly.

# Minimum salary filter

- [x] Remove the personalized match-score feature.
- [x] RED/GREEN: filter salary ranges by a selected minimum.
- [x] Add a minimum-salary dropdown to the existing filter stack.
- [x] Persist the selection in shareable filter URLs and active chips.
- [x] Add data and browser regression coverage.
- [x] Run typecheck, lint, audits, build, and React Doctor.
- [x] Push and verify the updated Vercel preview.

## Review

Removed the preference editor and all card scoring. Added Any salary and $80k-$200k thresholds to the existing advanced filters; disclosed ranges qualify when `max ?? min` reaches the floor, with active-chip and `minSalary` URL persistence. Typecheck, lint, build, 59 data checks, 33 browser checks, desktop/mobile visual checks, and React Doctor pass.

# Minimum salary review remediation

- [x] Restrict dollar thresholds to USD listings.
- [x] Add exact-boundary, single-value, missing-salary, and non-USD tests.
- [x] Replace the browser audit's circular result oracle.
- [x] Run full verification and repeat the thermonuclear review.
- [x] Push and verify the corrected Vercel preview.

## Review

Dollar thresholds now evaluate USD listings only. Data coverage includes exact range ceilings, single-value salaries, missing salaries, and high non-USD salaries; browser expectations are calculated independently from production filtering and assert included/excluded roles. Typecheck, lint, build, 59 data checks, 33 browser checks, React Doctor, and the repeated thermonuclear review pass cleanly.

# Public jobs API

- [x] Create an isolated branch and define the response contract.
- [x] RED/GREEN: return paginated active listings through the canonical filters.
- [x] Reject invalid filters, pagination, and unknown job IDs consistently.
- [x] Add collection and individual-job route handlers with cache headers.
- [x] Add executable data and HTTP audits plus feature evidence.
- [x] Run typecheck, lint, audits, build, and React Doctor.

## Review

Added public collection and item route handlers backed by the static normalized feed and canonical active/filter logic. The API validates filters and pagination, caps limits at 100, returns structured errors, exposes CORS and cache policy, and excludes inactive listings. Typecheck, lint, build, 60 data checks, 34 browser/HTTP checks, a live JSON sample, and React Doctor pass.

# API documentation

- [x] Add concise usage, filtering, pagination, caching, and error documentation.
- [x] Publish an OpenAPI 3.1 contract for collection and item endpoints.
- [x] Link API documentation and the specification from the README.
- [x] Validate examples and the machine-readable specification.

## Review

Added a concise usage guide and a public OpenAPI 3.1 specification covering collection and item routes, filters, pagination, schemas, errors, caching, and CORS. README discovery links are in place; JSON parsing, local-reference validation, typecheck, lint, 60 data checks, and production build pass.

# Jobs API thermonuclear remediation

- [x] Create one typed public query contract without UI sentinels.
- [x] Return a stable API filter DTO instead of `FilterState`.
- [x] Generate OpenAPI parameters from the canonical contract.
- [x] Validate representative 200, 400, and 404 bodies against OpenAPI.
- [x] Correct the human-readable base URL.
- [x] Run full verification and repeat thermonuclear review until clean.

## Review

Moved filtering into a shared domain module, made query parsing return one typed result, and generated OpenAPI parameters from the same contract. Applied filters now use a stable public DTO; Ajv validates representative success and error bodies. Typecheck, lint, build, 60 data audits, browser audit, diff checks, and the final thermonuclear review pass with no findings.

# OpenAPI site link

- [x] Add a visible OpenAPI documentation button to the site header.
- [x] Keep the action usable on mobile.
- [x] Run focused React and project verification.

## Review

Added an API docs action to the sticky header linking to the published OpenAPI JSON. The action stays visible as a compact icon on mobile. Typecheck, lint, and React Doctor pass with no findings.

# Pull request review loop

- [ ] Open a ready pull request for `feature/jobs-api`.
- [ ] Wait for Copilot review and inspect unresolved threads.
- [ ] Address actionable comments, verify, push, and request re-review.
- [ ] Repeat until a full review cycle returns no comments.

## Review

Pending.
