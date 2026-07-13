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
