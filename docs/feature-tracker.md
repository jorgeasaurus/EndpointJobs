# Feature tracker

`docs/feature-tracker.csv` is the canonical tracker for the Endpoint Jobs quality pass. It is plain CSV and opens in Excel or Google Sheets. Do not add a second tracker.

Phase 1 filled `status` from the code, tests, migrations, and README. Phase 2 exercised every story on 2026-10-27. The unsigned run used a local production build of main at `31697a8`. The signed-in run used production `ebce720` (v0.1.28) with the approved test user. Phase 4 retested production on 2026-10-27 and updated `status`, `test_result`, `errors_found`, and `notes`. `expected_behavior` now matches the code after those fixes.

## Totals

101 stories.

| Status | Count |
| --- | --- |
| Implemented | 101 |

| Test result | Count |
| --- | --- |
| Pass | 96 |
| Fail | 2 (`RESP-01`, `JOB-04`) |
| Blocked | 3 (`AUTH-02`, `AUTH-03`, `AUTH-08`) |

`Pass` means the observed behavior matched `expected_behavior`, including a documented Missing or Broken story. `Fail` means the run differed from `expected_behavior`. `Blocked` means the check could not be completed in that environment.

`AUTH-02` and `AUTH-03` are Blocked on a real OAuth login. A bad callback code does not sign the user out, and the success path still needs a provider round trip. `AUTH-08` is Blocked on a keyless build, because production has the Supabase public keys and renders Sign in. RLS for `ACCT-08` passed: 75 of 75 checks on `profiles`, `user_preferences`, `saved_jobs`, `job_views`, and `record_job_view`.

## Fix pull requests

`status` and `test_result` stay as recorded on 2026-10-27. `fix_pr` points at the pull request that addresses the failure.

| Pull request | Stories |
| --- | --- |
| https://github.com/jorgeasaurus/EndpointJobs/pull/87 | `SAL-02`, `HOME-06`, `API-05`, `BOARD-04`, `FEED-01`, `JOB-11` |
| https://github.com/jorgeasaurus/EndpointJobs/pull/88 | `ACCT-01` through `ACCT-07`, `PRIV-01` |
| https://github.com/jorgeasaurus/EndpointJobs/pull/89 | `HOME-04`, `AUTH-09` |

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
| `status` | `Implemented`, `Partial`, `Missing`, or `Broken`. |
| `last_tested` | Date the story was last exercised. |
| `test_result` | `Pass`, `Fail`, or `Blocked`. |
| `errors_found` | Failures seen while testing. Empty when the run passed or was blocked with the reason in `notes`. |
| `fix_pr` | Pull request that fixes a failure, when there is one. |
| `notes` | Limits, owner reports, and where a related story carries the rest of the behavior. |

## Status values

- **Implemented** — the product does what the acceptance criteria say.
- **Partial** — some of the behavior is present, and the rest is not.
- **Missing** — the story describes a behavior the product does not provide. A table or a sentence in the privacy policy is not enough to mark it implemented.
- **Broken** — the product attempts the behavior, and the result does not match the destination or rule the code is aiming at.
