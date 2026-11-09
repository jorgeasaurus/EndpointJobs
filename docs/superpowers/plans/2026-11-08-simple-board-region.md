# Simple board and JobPosting region Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the approved redundant public copy and emit `addressRegion` only from an explicit US state or Swiss canton already in the location text.

**Architecture:** One pure function, `jobPostingAddress`, is called by `getJobPostingJsonLd`. Public pages delete copy in place. Eligibility, feed files, and URL parameters stay as they are.

**Tech Stack:** Next.js, React, TypeScript, node:test, Playwright. No new dependencies.

## Global Constraints

- No stack rewrite and no new packages.
- Keep salary-only “Newest with salary”, saved jobs, auth, filter and search URL parameters, analytics, accessibility labels, errors, legal copy, and the coverage rail.
- Do not invent street, postal code, salary, or a locality for country-only text.
- Do not rewrite `src/data/jobs.json` or publish a feed.
- Do not merge, deploy, or submit Search Console.

---

### Task 1: Address fixtures and parser

**Files:**
- Create: `scripts/audits/job-posting-address.test.ts`
- Modify: `src/lib/location-context.ts`
- Modify: `src/lib/rich-result-schema.ts`
- Modify: `src/app/structured-data.ts`

**Interfaces:**
- Produces: `jobPostingAddress(location: string, addressCountry: string)` returning a PostalAddress object with `addressCountry` and optional `addressLocality` and `addressRegion`.

- [x] **Step 1:** Add fixtures for Memphis TN, Costa Mesa California United States, Eysins Vaud Switzerland, Hyderabad India, San Francisco, country-only text, and ambiguous extra-comma text. Assert no street, postal code, salary, or `TELECOMMUTE`, and that remote and semicolon jobs still omit `JobPosting`.
- [x] **Step 2:** Run `./node_modules/.bin/tsx --test scripts/audits/job-posting-address.test.ts` and confirm the new cases fail.
- [x] **Step 3:** Parse source text only. Recognize explicit US states when the country is US and explicit Swiss cantons when the country is CH.
- [x] **Step 4:** Re-run the test file and confirm it passes.

### Task 2: Public copy

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/job-board/controls.tsx`
- Modify: `src/components/job-board/results-panel.tsx`
- Modify: `src/components/job-board/job-map.tsx`
- Modify: `src/components/job-board/job-comparison.tsx`
- Modify: `src/app/jobs/[id]/page.tsx`
- Modify: `src/app/job-board.css`
- Modify: `src/app/job-board-responsive.css`
- Modify: `src/app/job-board-map.css`
- Modify tests listed in the spec’s locked strings.

- [x] **Step 1:** Update source and Playwright assertions for the removed strings.
- [x] **Step 2:** Remove the approved copy. Keep the results heading at its current size as the board `h1`.
- [x] **Step 3:** Run `npm test`, `npm run typecheck`, and `npm run lint`.

### Task 3: Verify and review

- [x] **Step 1:** Run `npm run audit:data`, `npm run build`, and the board, home, and pages Playwright specs.
- [x] **Step 2:** Screenshot home, board, a filtered and sorted URL, saved-jobs fixture, and a job page at desktop and mobile.
- [ ] **Step 3:** Open the PR with the Google doc links and the warnings that remain. Request Copilot review and fix only actionable findings.
