# Feature tracker

`docs/feature-tracker.csv` is the canonical tracker for the Endpoint Jobs quality pass. It is plain CSV and opens in Excel or Google Sheets. Do not add a second tracker.

Phase 1 filled the inventory from the code, tests, migrations, and README. Later passes recorded what they saw. The 2026-10-31 pass retested current main, including the learning roadmap and the stats breakdowns, on a local dev server. `status` for this pass is `pass`, `fail`, `fixed`, `retest-pass`, `untested`, or `untested-needs-signed-in`.

## Totals

108 stories.

| Status | Count |
| --- | --- |
| pass | 95 |
| retest-pass | 1 (`STAT-01`) |
| untested | 2 (`FRESH-05`, `API-05`) |
| untested-needs-signed-in | 10 (`AUTH-02`, `AUTH-03`, `ACCT-01` through `ACCT-08`) |

`FRESH-05` was not dispatched. `API-05` was not executed because PowerShell is not installed in this environment. The account and OAuth stories in the last row need a real signed-in session, which this pass did not create. `PERF-01` passed: the prerendered home document is 46,897 bytes and contains `Remote/hybrid`.

`pass` and `retest-pass` mean this pass matched `expected_behavior`. `untested` and `untested-needs-signed-in` mean it did not, and `notes` says why. `fix_pr` still points at older pull requests.

## Fix pull requests

These pull requests are the earlier fixes. This pass did not merge them again.

| Pull request | Stories |
| --- | --- |
| https://github.com/jorgeasaurus/EndpointJobs/pull/87 | `SAL-02`, `HOME-06`, `API-05`, `BOARD-04`, `FEED-01`, `JOB-11` |
| https://github.com/jorgeasaurus/EndpointJobs/pull/88 | `ACCT-01` through `ACCT-07`, `PRIV-01` |
| https://github.com/jorgeasaurus/EndpointJobs/pull/89 | `HOME-04`, `AUTH-09` |
| https://github.com/jorgeasaurus/EndpointJobs/pull/90 | `RESP-01`, `JOB-04` |

`HOME-04` and `AUTH-09` point at #89. That pull request replaces the home sign-in sentence with inline Google and GitHub buttons, and keeps the account menu inside the viewport with keyboard focus on the panel, then Account, then Sign out. #88 still adds saved jobs, saved filters, and view history.

## Columns

| Column | Meaning |
| --- | --- |
| `id` | Stable story id, such as `AUTH-01`. Do not renumber a story once it exists. |
| `area` | Product area, such as Home, Auth, or Account. |
| `feature` | Short name of the user-facing feature. |
| `user_story` | `As a … I want … so that …` |
| `expected_behavior` | Concrete acceptance criteria taken from the code. Multiple criteria are separated with ` \| `. |
| `source_files` | Files that implement or define the behavior, separated with `; `. |
| `existing_tests` | Tests or audit scripts that already exercise the behavior. Empty when none do. |
| `status` | `pass`, `fail`, `fixed`, `retest-pass`, `untested`, or `untested-needs-signed-in`. |
| `last_tested` | Date the story was last exercised. |
| `test_result` | `Pass` when this pass confirmed the story. Empty when it was not run. |
| `errors_found` | Failures seen while testing. Empty when the run passed or was left untested with the reason in `notes`. |
| `fix_pr` | Pull request that fixes a failure, when there is one. |
| `notes` | Limits, owner reports, and where a related story carries the rest of the behavior. |
| `fix_commit` | Commit that fixes a failure found in this pass, when there is one. |

## Status values

- **pass** — this pass confirmed the acceptance criteria.
- **fail** — this pass saw a result that does not match the acceptance criteria.
- **fixed** — a failure from this pass has a fix that is not retested yet.
- **retest-pass** — a failure from this pass was fixed and confirmed again.
- **untested** — this pass did not run the story. The reason is in `notes`.
- **untested-needs-signed-in** — the story needs a real signed-in session. This pass did not create one and did not use production credentials.
