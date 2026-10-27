# Feature tracker

`docs/feature-tracker.csv` is the canonical tracker for the Endpoint Jobs quality pass. It is plain CSV and opens in Excel or Google Sheets. Do not add a second tracker.

Phase 1 filled `status` from the code, tests, migrations, and README. `last_tested`, `test_result`, and `errors_found` are empty until a later phase runs the stories.

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
| `last_tested` | Date the story was last exercised. Empty in phase 1. |
| `test_result` | Result of that run. Empty in phase 1. |
| `errors_found` | Failures seen while testing. Empty in phase 1. |
| `fix_pr` | Pull request that fixes a failure, when there is one. |
| `notes` | Limits, owner reports, and where a related story carries the rest of the behavior. |

## Status values

- **Implemented** — the product does what the acceptance criteria say.
- **Partial** — some of the behavior is present, and the rest is not.
- **Missing** — the story describes a behavior the product does not provide. A table or a sentence in the privacy policy is not enough to mark it implemented.
- **Broken** — the product attempts the behavior, and the result does not match the destination or rule the code is aiming at.
