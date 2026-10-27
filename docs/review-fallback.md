# Copilot review with a Bugbot fallback

`.github/workflows/review-fallback.yml` runs on every ready pull request open, push, reopen, and ready-for-review event. Draft pull requests are skipped. A new push cancels the in-progress run for that pull request, so only the latest head is handled.

The job asks GitHub Copilot to review the pull request. If Copilot reviews that head, the job stops. If Copilot is unavailable, the job comments `bugbot run` so Cursor Bugbot can review instead.

## One-time setup

1. Create a fine-grained personal access token scoped only to `jorgeasaurus/EndpointJobs`.
   Repository permission: **Pull requests: Read and write**. No other permissions are required. The workflow uses that token to request the Copilot reviewer, read reviews and comments, and post the fallback comment as you. GitHub documents this reviewer as `copilot-pull-request-reviewer[bot]` on `POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers`.
2. In this repository, open **Settings → Secrets and variables → Actions** and add the token as `REVIEW_TRIGGER_TOKEN`. Do not use `GITHUB_TOKEN` for the fallback comment. Bugbot ignores comments from bots and GitHub Apps.
3. In Cursor, set Bugbot to manual-only: **Run only when mentioned** (`cursor review` or `bugbot run`). Do this on the personal Bugbot settings for the accounts that open pull requests. For the repository, turn on manual-only as well (`manualTriggerOnly` in the [Bugbot repository settings](https://cursor.com/docs/bugbot)) so Bugbot does not also run automatically on every push. Personal settings override the repository for that author's pull requests.
4. Copilot code review must be available to the account that owns the token. The review is billed to that account. The workflow does not set a review effort; Copilot uses the token owner's saved effort, then the repository, organization, and the Balanced default.

If `REVIEW_TRIGGER_TOKEN` is missing, the workflow emits a notice and exits successfully. It does not fail the pull request. Pull requests from forks do not receive this secret, so they follow that same path.

## How "Copilot is unavailable" is decided

GitHub does not document an event for Copilot being out of credits. The timeout is the reliable signal.

The workflow treats Copilot as unavailable, and goes straight to Bugbot, when any of these happen:

- The review request returns a non-2xx response, including quota, budget, plan, or permission errors.
- Copilot submits a review or comment on this head whose body reports a usage, quota, or credit limit. Matching is case-insensitive and looks for limit language such as "reached their quota limit" or "exceeded your monthly quota", not for a review that merely discusses a quota field.
- No Copilot review for this head arrives within `POLL_TIMEOUT_SECONDS` (default `600`, checked every `POLL_INTERVAL_SECONDS`, default `30`). Both are set at the top of the workflow. A failed read during that wait, such as HTTP 502 or a secondary rate limit, is logged and the next poll still runs. The wait ends at the deadline.

A submitted Copilot review whose `commit_id` is the pull request head, and whose body is not a limit message, counts as reviewed. The job then exits without commenting.

## The Bugbot comment

The comment body is exactly `bugbot run`. The head SHA is not stored in that comment. Before posting, the job lists pull request comments. On `synchronize` and `opened`, it skips a second `bugbot run` when one was created at or after `pull_request.updated_at` (the push or open time; the run start is used only if that value is missing). On `ready_for_review` and `reopened`, `updated_at` is the time of that action, so the bound is the head commit's committer date from `GET /repos/{owner}/{repo}/commits/{head_sha}`. Only a `bugbot run` comment created at or after that date blocks another post. A comment for an earlier head, created before this commit, does not. That commit read uses the same token and needs no extra permission. The comment-list read and, on those two actions, the commit read have to succeed. If either fails, the job stops without posting. The job summary includes a hidden marker for the run, for example:

```html
<!-- review-fallback: outcome=bugbot-triggered sha=<head> -->
```

The Actions token only has `contents: read` and `pull-requests: read`. Those permissions check out the repository. Every GitHub write uses `REVIEW_TRIGGER_TOKEN`.
