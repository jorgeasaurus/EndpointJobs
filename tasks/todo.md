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
- [x] Add missing stories for live coverage metrics and feed safety.
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

- [x] Open a ready pull request for `feature/jobs-api`.
- [x] Wait for Copilot review and inspect unresolved threads.
- [x] Address actionable comments, verify, push, and request re-review.
- [x] Repeat until a full review cycle returns no comments.

## Review

Opened ready PR #12 and completed five Copilot review cycles. Addressed nine comments across API normalization, OpenAPI/docs accuracy, header behavior, import clarity, and PR scope; all threads are resolved. The final Copilot review returned no new comments, all PR checks pass, and the working tree is clean.

# PowerShell API examples

- [x] Add PowerShell invocation examples to the API guide.
- [x] Point the site API button to the rendered GitHub guide.
- [x] Run typecheck, lint, and React Doctor.

## Review

Added copy-ready PowerShell examples for collection, filtered pagination, and item requests. The header API button now opens the rendered branch guide on GitHub in a new tab. Typecheck, lint, React Doctor, and diff checks pass.

# API docs link hotfix

- [x] Replace the deleted feature-branch documentation URL with the durable `main` URL.
- [x] Run focused verification and push the hotfix.

## Review

The API docs button now targets `main/docs/api.md`, which remains valid after feature-branch deletion. The destination returns successfully; typecheck, lint, React Doctor, and diff checks pass.

# PowerShell example outputs

- [x] Call each documented API flow against production.
- [x] Add concise, real output beneath each PowerShell example.
- [x] Verify documentation and push the update.

## Review

Called the live collection, filtered collection, and item endpoints and added representative PowerShell output for each. The guide records the capture date because listing counts and values refresh. JSON parsing, typecheck, lint, and diff checks pass.

# SerpAPI description line breaks

- [x] Reproduce line-break loss through SerpAPI normalization.
- [x] Identify the exact normalization boundary causing the loss.
- [x] RED/GREEN: preserve paragraph and bullet breaks without provider-specific UI logic.
- [x] Run focused and full verification.
- [x] Record root cause and results.

## Review

SerpAPI descriptions sometimes contain literal newline markers or arrive flattened despite structured `job_highlights`. Provider normalization now decodes literal markers and conservatively inserts breaks only when every highlight item has one unique ordered match; ambiguous text remains unchanged. Typecheck, lint, build, and the SerpAPI audit pass; the full data audit retains main's unrelated feed-dependent FEAT-061 failure.

# PR 14 review loop

- [x] Guard malformed SerpAPI highlight payloads.
- [x] Run focused and full verification.
- [x] Push the fix, resolve the thread, and request Copilot re-review.
- [x] Repeat until a full review cycle returns no comments.

## Review

Malformed highlight containers, sections, item arrays, and item values now preserve the normalized description without throwing. Typecheck, lint, 60 data audits, and production build pass; Copilot's repeated review found no issues.

# PowerShell salary-label example

- [x] Run the minimum-salary query against the live API.
- [x] Add the nested salary label and application URL example with output.
- [x] Verify the documentation diff.

## Review

Added the exact remote minimum-salary request with a calculated `salary.label` property and representative live output. The production request and `git diff --check` pass.

# EndpointJobs PowerShell module

- [x] Define the public cmdlet and API parameter contract.
- [x] Scaffold the module manifest, loader, build, and analyzer settings.
- [x] Implement request, pagination, and API error handling.
- [x] Add focused Pester tests for list and item requests.
- [x] Run manifest, analyzer, tests, build, and a live smoke test.

## Review

Added an in-repo EndpointJobs module with filtered collection queries, streamed and raw responses, automatic pagination, pipeline item lookup, typed output, and structured API errors. PSScriptAnalyzer, manifest/build validation, eight Pester tests, diff checks, and a live list-to-item production smoke test pass.

# PowerShell module publishing workflow

- [x] Match the InTUI and IntuneHydrationKit release convention.
- [x] Add scoped cross-platform module CI and artifact creation.
- [x] Publish version-matched tags to PowerShell Gallery.
- [x] Create the versioned archive and GitHub release.
- [x] Validate workflow syntax and rerun module CI.

## Review

Added a module-scoped three-OS CI/CD workflow matching the established tag, artifact, PSGallery, archive, and GitHub Release conventions. YAML parsing, path and version checks, module CI, eight Pester tests, build-manifest validation, and a `Publish-Module -WhatIf` package validation pass.

# PowerShell module thermo-nuclear review

- [x] Audit module structure, runtime contract, errors, and packaging.
- [x] Audit workflow permissions, reproducibility, and release retryability.
- [x] Remove dynamic loading and verify the built artifact.
- [x] Add Windows PowerShell 5.1 and pinned dependency coverage.
- [x] Repeat strict review and rerun all verification.

## Review

Repeated clean-room reviews strictly approve the module and workflow. Module releases use the isolated `powershell-v*.*.*` tag namespace; actions and tools are pinned without publisher-check bypasses, provenance is restricted to `main`, existing Gallery/GitHub content is verified before recovery, and tag data remains quoted environment input. Analyzer, 10 Pester tests, build/package validation, tag validation, YAML parsing, and diff checks pass.

# PowerShell example screenshot

- [x] Add the supplied terminal screenshot to the API guide.
- [x] Verify the image path and documentation diff.

## Review

Added the supplied `limit=5` terminal output beneath the related PowerShell example. The image path resolves and `git diff --check` passes.

# One-day freshness filter

- [x] RED: prove jobs posted within one day are included and older jobs are excluded.
- [x] GREEN: add `1` to the shared freshness contract and UI option.
- [x] Verify URL, API, OpenAPI, documentation, and user-story coverage.
- [x] Run typecheck, lint, data/browser audits, build, and React Doctor.
- [x] Review the final diff for minimal scope and record results.

## Review

Added Last 1 day as a shared UI/API freshness value with 24-hour filtering, URL persistence, active-chip text, generated OpenAPI enums, and documentation. Typecheck, lint, build, 60 data checks, and 34 browser checks pass; React Doctor reports 91/100 with two pre-existing small-array lookup advisories and no feature regression.

# One-day freshness review remediation

- [x] RED/GREEN: lock exact freshness cutoffs with timestamp-boundary tests.
- [x] Replace floored-age filtering with an explicit timestamp helper.
- [x] Remove UI-layer freshness pass-through exports.
- [x] Generate applied-filter OpenAPI enums through one generic contract path.
- [x] Add direct OpenAPI response-contract coverage.
- [x] Run full verification and repeat the thermo-nuclear review.

## Review

Replaced implicit floored-age comparison with a tested timestamp cutoff, removed UI pass-through exports, and generated all enum-valued applied-filter schemas from the canonical API contract. Typecheck, lint, build, 60 data checks, 34 browser checks, and the repeated thermo-nuclear review pass cleanly; React Doctor retains two pre-existing small-array advisories.

# Research potential new job sources

- [x] Inventory current providers and employer-specific ATS coverage.
- [x] Measure current feed concentration and coverage gaps.
- [x] Research public boards, aggregators, and unsupported ATS families.
- [x] Validate access, terms, duplication risk, and implementation effort.
- [x] Rank source candidates and record recommendations.

## Review

Prioritize SmartRecruiters, USAJOBS, France Travail, and Recruitee; pilot authorized NEOGOV and Jobvite feeds next. Before adding volume, fix canonical-URL dedupe, unknown-date ranking, and direct-source cap pressure; 82.8% of the current 500-row feed comes from SerpAPI and Adzuna.

# Implement new job sources and Germany coverage

- [x] RED/GREEN: prefer canonical direct postings and known publication dates.
- [x] RED/GREEN: add SmartRecruiters normalization and configured boards.
- [x] RED/GREEN: add Recruitee normalization and configured accounts.
- [x] Expand verified direct ATS targets using existing adapters.
- [x] Add Germany to every country-aware scheduled source.
- [x] Refresh targeted sources and verify accepted job yield.
- [x] Run typecheck, lint, data/browser audits, build, and final review.

## Review

Added default SmartRecruiters and Recruitee sources, optional USAJOBS support, six verified Workday targets, and 1Password's Ashby board. Germany is scheduled across country-aware providers with German search/taxonomy/map coverage; live probes accepted one Recruitee and one SmartRecruiters role. Typecheck, lint, build, 60 data checks, 34 browser checks, seven focused tests, diff checks, and changed-file React Doctor pass.

# Publish new job sources preview

- [x] Commit and push the feature branch.
- [x] Dispatch and verify the job refresh workflow.
- [x] Synchronize the refreshed feed commit.
- [x] Deploy and verify a Vercel preview.

## Review

Pushed the feature branch, ran GitHub Actions refresh `29387102479`, and synchronized its 500-job feed commit. Feed verification found and fixed one ambiguous `Stuttgart, AR` Germany mapping; the preview homepage and Germany-filtered API return 200, with 21 Germany-based roles.

# PR 15 Copilot review loop

- [x] Address every actionable review thread.
- [x] Create and validate a reusable review-loop skill.
- [x] Request repeated Copilot reviews until a clean cycle.
- [x] Run verification and record the final review state.

## Review

Repeated Copilot cycles addressed every actionable comment; two rejected findings are answered with passing regressions. The final latest-head review generated no new comments. Eleven focused tests, 60 data audits, typecheck, lint, build, and diff checks pass; the reusable skill is validated and forward-tested.

# PowerShell module README and site link

- [x] Add concise installation, usage, and development documentation.
- [x] Add an accessible site button with a durable README URL.
- [x] Add regression coverage for the button contract.
- [x] Run module and site verification.

## Review

Added a concise module guide covering installation, filtering, pipeline lookup, raw responses, help, and development. The desktop top bar now links to the durable README with accessible external-link behavior; 11 PowerShell tests, typecheck, lint, production build, 60 data audits, and 34 browser audits pass.

# Reject finance job false positives

- [x] RED/GREEN: reject corporate-finance roles admitted by broad department metadata.
- [x] Preserve legitimate endpoint roles within Corporate Engineering organizations.
- [x] Regenerate the feed and remove the confirmed production false positives.
- [x] Run full verification and open a pull request.

## Review

Removed Corporate Engineering and Enterprise Engineering as standalone endpoint signals while preserving roles with concrete client-platform, device, or endpoint evidence. Removed eight confirmed Greenhouse false positives from the generated feed; typecheck, lint, production build, 60 data audits, and 34 browser audits pass.

# Remove popular footer searches

- [x] Reproduce the broken production navigation.
- [x] Remove footer markup, metadata, JSON-LD, and styles.
- [x] Remove stale feature claims and replace them with absence checks.
- [x] Run data, browser, type, lint, and build verification.

## Review

Reproduced production links dropping their query and returning to the unfiltered home page. Removed the feature from the footer, site metadata, JSON-LD, desktop/mobile styles, and stale audits while retaining project links; typecheck, lint, production build, 60 data audits, and 33 browser audits pass.
