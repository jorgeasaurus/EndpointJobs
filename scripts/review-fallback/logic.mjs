/**
 * Decide whether GitHub Copilot reviewed the current pull request head,
 * and whether a Bugbot fallback comment is still needed.
 * The workflow posts the comment; this module stays free of I/O.
 */

export const COPILOT_REVIEWER = "copilot-pull-request-reviewer[bot]";
export const BUGBOT_COMMENT_BODY = "bugbot run";
export const GITHUB_API_VERSION = "2026-03-10";

const COPILOT_LOGINS = new Set([
  "copilot-pull-request-reviewer[bot]",
  "copilot-pull-request-reviewer",
]);

const SUBMITTED_REVIEW_STATES = new Set([
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
]);

/**
 * Conservative, case-insensitive phrases. A normal review that merely
 * mentions a quota field or asks for a usage limit does not match.
 */
const USAGE_LIMIT_PATTERNS = [
  /quota limit/,
  /quota exhausted/,
  /quota exceeded/,
  /exceeded (?:your|their|the) monthly quota/,
  /reached (?:your|their|its|the) (?:monthly )?quota/,
  /out of credits?/,
  /insufficient credits?/,
  /no remaining (?:premium requests?|credits?)/,
  /credit limit (?:exceeded|exhausted|reached)/,
  /(?:exceeded|exhausted|reached) (?:your|their|the |a )?credit limit/,
  /usage limit (?:exceeded|exhausted|reached)/,
  /(?:exceeded|exhausted|reached) (?:your|their|the |a )?usage limit/,
  /premium requests? (?:limit )?(?:exceeded|exhausted|reached|depleted)/,
  /(?:exceeded|exhausted|reached|depleted).{0,40}premium requests?/,
];

export function redact(text, token) {
  let value = String(text ?? "");
  const tokens = Array.isArray(token) ? token : [token];
  for (const secret of tokens) {
    if (secret) value = value.split(secret).join("[redacted]");
  }
  return value
    .replace(/bearer\s+\S+/gi, "bearer [redacted]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g, "[redacted]");
}

export function isSuccessStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 300;
}

export function indicatesUsageLimit(body) {
  if (typeof body !== "string" || body.trim() === "") return false;
  const text = body.toLowerCase().replace(/\s+/g, " ");
  return USAGE_LIMIT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isCopilotAuthor(user) {
  const login = typeof user === "string" ? user : user?.login;
  return typeof login === "string" && COPILOT_LOGINS.has(login.toLowerCase());
}

export function isExactBugbotBody(body) {
  return typeof body === "string" && body.replace(/\r\n/g, "\n").trim() === BUGBOT_COMMENT_BODY;
}

function sameSha(left, right) {
  return typeof left === "string" && typeof right === "string" && left.length > 0 && left.toLowerCase() === right.toLowerCase();
}

function isSubmittedReview(review) {
  if (!review?.state) return true;
  return SUBMITTED_REVIEW_STATES.has(String(review.state).toUpperCase());
}

function publicApiMessage(body) {
  const message = typeof body === "string" ? body : body?.message;
  if (typeof message !== "string") return "";
  const cleaned = message.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 240);
}

export function describeRequestFailure(status, body) {
  const detail = publicApiMessage(body);
  return detail ? `HTTP ${status}: ${detail}` : `HTTP ${status}`;
}

/**
 * @returns {{kind: "reviewed"} | {kind: "unavailable", reason: "usage-limit", source: string} | {kind: "pending"}}
 */
export function classifyCopilotActivity({
  headSha,
  reviews = [],
  reviewComments = [],
  issueComments = [],
  requestedAtMs = 0,
}) {
  const onHead = (item) => sameSha(item?.commit_id, headSha) || sameSha(item?.original_commit_id, headSha);
  const submitted = (reviews ?? []).filter(
    (review) => isCopilotAuthor(review?.user) && sameSha(review?.commit_id, headSha) && isSubmittedReview(review),
  );
  const quotaReviewComment = (reviewComments ?? []).find(
    (comment) => isCopilotAuthor(comment?.user) && onHead(comment) && indicatesUsageLimit(comment?.body),
  );
  const quotaReview = submitted.find((review) => indicatesUsageLimit(review?.body));
  const realReview = submitted.find((review) => !indicatesUsageLimit(review?.body));
  if (realReview && !quotaReviewComment) return { kind: "reviewed" };

  if (quotaReview || quotaReviewComment) {
    return {
      kind: "unavailable",
      reason: "usage-limit",
      source: quotaReview ? "review" : "review-comment",
    };
  }

  const quotaIssue = (issueComments ?? []).find((comment) => {
    if (!isCopilotAuthor(comment?.user) || !indicatesUsageLimit(comment?.body)) return false;
    const created = Date.parse(comment?.created_at ?? "");
    return Number.isFinite(created) && created >= requestedAtMs;
  });
  if (quotaIssue) return { kind: "unavailable", reason: "usage-limit", source: "issue-comment" };

  return { kind: "pending" };
}

export function parseTime(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const PUSH_BOUND_ACTIONS = new Set(["ready_for_review", "reopened"]);
const PUSH_ACTIVITY_TYPES = new Set(["push", "force_push", "branch_creation"]);

/**
 * A `bugbot run` comment covers this head when it was created at or after
 * `headPushedAtMs`. Callers pass the push or open time on `synchronize` and
 * `opened`. On `ready_for_review` and `reopened` they pass the timestamp of
 * the push that set this head, because `updated_at` is the time of that
 * action and the committer date can be earlier than the push.
 *
 * @returns {{known: boolean, requested: boolean}}
 */
export function bugbotAlreadyRequestedForHead({ issueComments = [], headPushedAtMs }) {
  const comments = (issueComments ?? []).filter((comment) => isExactBugbotBody(comment?.body));
  const pushedAt = parseTime(headPushedAtMs);
  if (pushedAt == null) return { known: false, requested: false };
  const requested = comments.some((comment) => {
    const created = parseTime(comment?.created_at);
    return created != null && created >= pushedAt;
  });
  return { known: true, requested };
}

function activityBeforeCursor(headers) {
  const link = headers?.link ?? "";
  for (const part of String(link).split(",")) {
    if (!/rel="next"/i.test(part)) continue;
    const match = part.match(/[?&]before=([^&>]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

async function headPushBoundMs(client, headRef, sha) {
  if (!client) throw new Error("CONTENTS_TOKEN is not set");
  const ref = typeof headRef === "string" ? headRef.trim() : "";
  if (!ref) throw new Error("HEAD_REF is required");
  let before = "";
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ ref, per_page: "100", direction: "desc" });
    if (before) query.set("before", before);
    const response = await client.request("GET", `/activity?${query}`);
    if (!isSuccessStatus(response.status)) {
      throw new Error(`GET /activity failed with ${describeRequestFailure(response.status, response.body)}`);
    }
    const batch = Array.isArray(response.body) ? response.body : [];
    const match = batch.find((item) => PUSH_ACTIVITY_TYPES.has(item?.activity_type) && sameSha(item?.after, sha));
    if (match) {
      const bound = parseTime(match.timestamp);
      if (bound == null) throw new Error(`GET /activity did not include a push timestamp for ${sha}`);
      return bound;
    }
    before = activityBeforeCursor(response.headers);
    if (!before || batch.length === 0) break;
  }
  throw new Error(`GET /activity did not include a push for ${sha}`);
}

export function renderSummary({ outcome, headSha = "", detail = "" }) {
  const markerSha = /^[0-9a-f]{40}$/i.test(headSha) ? headSha.toLowerCase() : "";
  const sha = markerSha || "unknown";
  const lines = ["## Review fallback", ""];
  switch (outcome) {
    case "skipped-no-token":
      lines.push("`REVIEW_TRIGGER_TOKEN` is not set, so Copilot was not requested and Bugbot was not triggered.");
      lines.push("Add a fine-grained PAT with Pull requests read and write on this repository. See `docs/review-fallback.md`.");
      break;
    case "copilot-reviewed":
      lines.push(`Copilot reviewed head \`${sha}\`.`);
      break;
    case "bugbot-triggered":
      lines.push(`Copilot was unavailable (${detail}).`);
      lines.push(`Posted \`${BUGBOT_COMMENT_BODY}\` for head \`${sha}\`.`);
      break;
    case "bugbot-already-requested":
      lines.push(`Copilot was unavailable (${detail}).`);
      lines.push(`A \`${BUGBOT_COMMENT_BODY}\` comment already covers head \`${sha}\`, so another comment was not posted.`);
      break;
    case "bugbot-skipped-uncertain":
      lines.push(`Copilot was unavailable (${detail}).`);
      lines.push(`This head's push time was not available. An existing \`${BUGBOT_COMMENT_BODY}\` comment was left in place so this run would not post a duplicate.`);
      break;
    case "failed":
      lines.push(`Review fallback failed before it could finish (${detail}).`);
      lines.push("Bugbot was not triggered.");
      break;
    default:
      lines.push(detail || outcome);
      break;
  }
  lines.push("");
  lines.push(`<!-- review-fallback: outcome=${outcome} sha=${markerSha} -->`);
  return lines.join("\n");
}

export function assertRepo(repo) {
  if (typeof repo !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("GITHUB_REPOSITORY must look like owner/repo");
  }
  return repo;
}

export function assertPullNumber(value) {
  if (!/^[1-9]\d*$/.test(String(value ?? ""))) {
    throw new Error("PR_NUMBER must be a positive integer");
  }
  return String(value);
}

export function assertHeadSha(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error("HEAD_SHA must be a 40-character commit SHA");
  }
  return value.toLowerCase();
}

function usageLimitDetail(source) {
  const where = source === "issue-comment" ? "pull request comment" : source === "review-comment" ? "review comment" : "review";
  return `Copilot ${where} reports a usage, quota, or credit limit`;
}

async function listAll(client, path) {
  const items = [];
  const seen = new Set();
  for (let page = 1; page <= 20; page += 1) {
    const response = await client.request("GET", `${path}?per_page=100&page=${page}`);
    if (!isSuccessStatus(response.status)) {
      throw new Error(`GET ${path} failed with ${describeRequestFailure(response.status, response.body)}`);
    }
    const batch = Array.isArray(response.body) ? response.body : [];
    if (batch.length === 0) break;
    const marker = String(batch[0]?.id ?? batch[0]?.node_id ?? page);
    if (seen.has(marker)) break;
    seen.add(marker);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

async function loadActivity(client, prNumber) {
  const [reviews, reviewComments, issueComments] = await Promise.all([
    listAll(client, `/pulls/${prNumber}/reviews`),
    listAll(client, `/pulls/${prNumber}/comments`),
    listAll(client, `/issues/${prNumber}/comments`),
  ]);
  return { reviews, reviewComments, issueComments };
}

function result({ exitCode, outcome, reason = "", headSha, logs }) {
  return {
    exitCode,
    outcome,
    reason,
    headSha,
    summary: renderSummary({ outcome, headSha, detail: reason }),
    logs,
  };
}

export async function runReviewFallback({
  token = "",
  repo,
  prNumber,
  headSha,
  pollIntervalSeconds = 30,
  pollTimeoutSeconds = 600,
  reviewer = COPILOT_REVIEWER,
  headPushedAt,
  headRef = "",
  action = "",
  github,
  contentsToken = "",
  contentsGithub,
  fetchImpl,
  apiBase = "https://api.github.com",
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
} = {}) {
  const secret = typeof token === "string" ? token.trim() : "";
  const contentsSecret = typeof contentsToken === "string" ? contentsToken.trim() : "";
  const secrets = [secret, contentsSecret].filter(Boolean);
  const notes = [];
  try {
    if (!secret) {
      return result({
        exitCode: 0,
        outcome: "skipped-no-token",
        headSha: typeof headSha === "string" ? headSha : "",
        logs: [
          "::notice title=Review fallback::REVIEW_TRIGGER_TOKEN is not set. Create a fine-grained PAT scoped to this repository with Pull requests read and write, add it as the REVIEW_TRIGGER_TOKEN Actions secret, and see docs/review-fallback.md. Copilot was not requested.",
        ],
      });
    }

    const repository = assertRepo(repo);
    const pullNumber = assertPullNumber(prNumber);
    const sha = assertHeadSha(headSha);
    const client = github ?? createGithubClient({ token: secret, repo: repository, fetchImpl, apiBase });
    const intervalMs = Math.max(0, Number(pollIntervalSeconds) || 0) * 1000;
    const timeoutMs = Math.max(0, Number(pollTimeoutSeconds) || 0) * 1000;
    const requestedAtMs = now();
    const pushedAtMs = parseTime(headPushedAt) ?? requestedAtMs;

    const request = await client.request("POST", `/pulls/${pullNumber}/requested_reviewers`, {
      reviewers: [reviewer],
    });

    let unavailableReason = "";
    if (!isSuccessStatus(request.status)) {
      unavailableReason = `Copilot review request returned ${describeRequestFailure(request.status, request.body)}`;
    } else {
      const deadline = requestedAtMs + timeoutMs;
      while (!unavailableReason) {
        try {
          const activity = await loadActivity(client, pullNumber);
          const state = classifyCopilotActivity({ ...activity, headSha: sha, requestedAtMs });
          if (state.kind === "reviewed") {
            return result({
              exitCode: 0,
              outcome: "copilot-reviewed",
              headSha: sha,
              logs: [...notes, `Copilot reviewed ${sha}.`],
            });
          }
          if (state.kind === "unavailable") {
            unavailableReason = usageLimitDetail(state.source);
            break;
          }
        } catch (error) {
          const message = redact(error instanceof Error ? error.message : "read failed", secrets);
          notes.push(`Copilot poll read failed: ${message}`);
        }
        const remaining = deadline - now();
        if (remaining <= 0) {
          unavailableReason = `no Copilot review for this head after ${Math.round(timeoutMs / 1000)}s`;
          if (notes.length > 0) unavailableReason += `. ${notes[notes.length - 1]}`;
          break;
        }
        await sleep(Math.min(intervalMs, remaining));
      }
    }
    unavailableReason = redact(unavailableReason, secrets);

    const issueComments = await listAll(client, `/issues/${pullNumber}/comments`);
    const contentsClient = contentsGithub ?? (contentsSecret ? createGithubClient({ token: contentsSecret, repo: repository, fetchImpl, apiBase }) : null);
    const boundMs = PUSH_BOUND_ACTIONS.has(action) ? await headPushBoundMs(contentsClient, headRef, sha) : pushedAtMs;
    const dedup = bugbotAlreadyRequestedForHead({ issueComments, headPushedAtMs: boundMs });
    if (!dedup.known && issueComments.some((comment) => isExactBugbotBody(comment?.body))) {
      return result({
        exitCode: 0,
        outcome: "bugbot-skipped-uncertain",
        reason: unavailableReason,
        headSha: sha,
        logs: [...notes, `Copilot unavailable (${unavailableReason}). Skipped a second bugbot run comment because this head's push time was not available.`],
      });
    }
    if (dedup.requested) {
      return result({
        exitCode: 0,
        outcome: "bugbot-already-requested",
        reason: unavailableReason,
        headSha: sha,
        logs: [...notes, `Copilot unavailable (${unavailableReason}). bugbot run already covers ${sha}.`],
      });
    }

    const posted = await client.request("POST", `/issues/${pullNumber}/comments`, {
      body: BUGBOT_COMMENT_BODY,
    });
    if (!isSuccessStatus(posted.status)) {
      throw new Error(`POST /issues/${pullNumber}/comments failed with ${describeRequestFailure(posted.status, posted.body)}`);
    }
    if (!isExactBugbotBody(posted.body?.body) && posted.body?.body != null) {
      throw new Error("Bugbot comment was stored with an unexpected body");
    }

    return result({
      exitCode: 0,
      outcome: "bugbot-triggered",
      reason: unavailableReason,
      headSha: sha,
      logs: [...notes, `Copilot unavailable (${unavailableReason}). Posted bugbot run for ${sha}.`],
    });
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : "unexpected error", secrets);
    return result({
      exitCode: 1,
      outcome: "failed",
      reason: message,
      headSha: typeof headSha === "string" ? headSha : "",
      logs: [...notes, `Review fallback failed: ${message}`],
    });
  }
}

export function createGithubClient({ token, repo, fetchImpl = globalThis.fetch, apiBase = "https://api.github.com" }) {
  const repository = assertRepo(repo);
  const root = `${apiBase.replace(/\/$/, "")}/repos/${repository}`;
  return {
    async request(method, path, body) {
      let response;
      try {
        response = await fetchImpl(`${root}${path}`, {
          method,
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
            "User-Agent": "endpointjobs-review-fallback",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "request failed";
        throw new Error(`GitHub request failed: ${redact(message, token)}`);
      }
      const text = await response.text();
      let parsed = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { message: text.slice(0, 240) };
        }
      }
      return { status: response.status, body: parsed, headers: { link: response.headers?.get?.("link") ?? "" } };
    },
  };
}
