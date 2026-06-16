# Lessons

- For job API refresh checks, report raw provider counts and accepted endpoint-match counts from the GitHub Action before saying the feed is healthy.
- Coverage checks need real user-visible example titles, not only tool-keyword counts; include client engineering, end-user compute, and systems engineering title patterns.
- Endpoint searches need employer-targeted ATS probes for each screenshot batch; broad aggregators miss many LinkedIn-visible roles.
- Greenhouse board slugs can differ from employer names; check branded variants like `doordashusa` before marking a source unavailable.
- Mobile flex-column layouts need explicit `min-width: 0`/`width: 100%` checks on panels and cards; verify with narrow viewport box snapshots, not just screenshots.
- When a review flags file-size growth, split by responsibility and re-check line counts; moving bulk into a new oversized file does not resolve the design issue.
- Aggregator-style source requests still need per-provider activation checks; Workable requires account slugs and paid RSS feeds require feed URL/auth secrets before they can add production coverage.
- When decorative hero modules obscure the workflow, remove them and move core controls into the hero before adding more visual density.
- Job IDs must include entropy from the full source URL or native job ID; truncating long ATS URLs can collapse distinct roles into the same React key.
- Expandable content must add new information beyond the visible summary; provider snippets should not get expanders just because they are stored in a description-shaped field.
- Glassmorphism CSS needs `-webkit-backdrop-filter` beside `backdrop-filter`, and JSX toggle buttons may need literal `aria-pressed` branches to satisfy Edge Tools static diagnostics.
- Avoid adding persistent quick-chip rows inside the mobile hero unless explicitly requested; they consume scarce vertical space and can make the first viewport feel cluttered.
- Truncated job summaries must stop on word boundaries before UI prefix removal; otherwise expanded descriptions can start from the middle of a word.
