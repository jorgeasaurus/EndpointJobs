# Feature tracker

`docs/feature-tracker.csv` is the canonical tracker for the Endpoint Jobs quality pass. It is plain CSV and opens in Excel or Google Sheets. Do not add a second tracker.

Phase 1 filled `status` from the code, tests, migrations, and README. Phase 2 exercised every story on 2026-10-27. The unsigned run used a local production build of main at `31697a8`. The signed-in run used production `ebce720` (v0.1.28) with the approved test user. `status` was not changed by those runs.

## Totals

101 stories.

| Status | Count |
| --- | --- |
| Implemented | 91 |
| Partial | 2 (`HOME-04`, `PRIV-01`) |
| Missing | 7 (`ACCT-01` through `ACCT-07`) |
| Broken | 1 (`JOB-11`) |

| Test result | Count |
| --- | --- |
| Pass | 83 |
| Fail | 16 |
| Blocked | 2 (`AUTH-03`, `AUTH-08`) |

`Pass` means the observed behavior matched `expected_behavior`, including a documented Missing or Broken story. `Fail` means the run differed from `expected_behavior`. `Blocked` means the check could not be completed in that environment.

`AUTH-03` and the `AUTH-02` success path are Blocked on a real OAuth login. `AUTH-02` itself is Pass: a bad code does not sign the user out. `AUTH-08` is Blocked on a keyless build, because production has the Supabase public keys and renders Sign in. RLS for `ACCT-08` passed: 75 of 75 checks on `profiles`, `user_preferences`, `saved_jobs`, `job_views`, and `record_job_view`.

## Fix pull requests

`status` and `test_result` stay as recorded on 2026-10-27. `fix_pr` points at the pull request that addresses the failure.

| Pull request | Stories |
| --- | --- |
| https://github.com/jorgeasaurus/EndpointJobs/pull/87 | `RESP-01`, `SAL-02`, `HOME-06`, `API-05`, `BOARD-04`, `FEED-01`, `JOB-11` |
| https://github.com/jorgeasaurus/EndpointJobs/pull/88 | `ACCT-01` through `ACCT-07`, `HOME-04`, `PRIV-01` |

`HOME-04` points at #88 because that pull request adds saved jobs, saved filters, and view history. The home sign-in line itself is not part of #88. `AUTH-09` (menu position at 390px, Escape and outside-click close) and that home line are owned by a separate pull request titled “Fix mobile account menu and show inline sign-in on home”. That pull request was not open when `fix_pr` was filled, so `AUTH-09` stays empty.

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
