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
