import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  BUGBOT_COMMENT_BODY,
  COPILOT_REVIEWER,
  bugbotAlreadyRequestedForHead,
  classifyCopilotActivity,
  createGithubClient,
  indicatesUsageLimit,
  isExactBugbotBody,
  redact,
  renderSummary,
  runReviewFallback,
} from "./logic.mjs";
import { main, readConfig } from "./run.mjs";

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TOKEN = "github_pat_testtokenvalue";
const QUOTA_BODY = "Copilot was unable to review this pull request because the user who requested the review has reached their quota limit.";

function copilot(login = COPILOT_REVIEWER) {
  return { login, type: "Bot" };
}

function clock() {
  let now = 1_000;
  return {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
}

function fakeGithub({
  postStatus = 201,
  postBody = {},
  commentStatus = 201,
  reviews = [],
  reviewComments = [],
  issueComments = [],
  timeline = [],
  reviewsByCall,
} = {}) {
  const calls = [];
  let reviewReads = 0;
  return {
    calls,
    async request(method, path, body) {
      calls.push({ method, path, body });
      if (method === "POST" && path.endsWith("/requested_reviewers")) {
        return { status: postStatus, body: postBody };
      }
      if (method === "POST" && path.endsWith("/comments")) {
        return { status: commentStatus, body: { id: 50, body: body?.body ?? "" } };
      }
      if (method === "GET" && path.includes("/reviews?")) {
        reviewReads += 1;
        const page = reviewsByCall?.[reviewReads - 1] ?? reviews;
        return { status: 200, body: page };
      }
      if (method === "GET" && path.includes("/pulls/") && path.includes("/comments?")) {
        return { status: 200, body: reviewComments };
      }
      if (method === "GET" && path.includes("/issues/") && path.includes("/comments?")) {
        return { status: 200, body: issueComments };
      }
      if (method === "GET" && path.includes("/timeline?")) {
        return { status: 200, body: timeline };
      }
      return { status: 404, body: { message: "missing fake" } };
    },
  };
}

function postedBodies(github) {
  return github.calls.filter((call) => call.method === "POST" && call.path.endsWith("/comments")).map((call) => call.body.body);
}

test("usage-limit matching stays narrow", () => {
  assert.equal(indicatesUsageLimit(QUOTA_BODY), true);
  assert.equal(indicatesUsageLimit("YOU HAVE EXCEEDED YOUR MONTHLY QUOTA"), true);
  assert.equal(indicatesUsageLimit("out of credits"), true);
  assert.equal(indicatesUsageLimit("premium requests exhausted"), true);
  assert.equal(indicatesUsageLimit("reached the usage limit"), true);
  assert.equal(indicatesUsageLimit("credit limit exceeded"), true);
  assert.equal(indicatesUsageLimit("Add a usage limit to this client."), false);
  assert.equal(indicatesUsageLimit("The credit field is unused."), false);
  assert.equal(indicatesUsageLimit("Consider a rate limit on this endpoint."), false);
  assert.equal(indicatesUsageLimit("monthly quota of the billing plan"), false);
  assert.equal(indicatesUsageLimit(""), false);
  assert.equal(indicatesUsageLimit(null), false);
});

test("Copilot activity for the head SHA", () => {
  const reviewed = classifyCopilotActivity({
    headSha: HEAD,
    reviews: [
      { user: { login: "octocat" }, commit_id: HEAD, state: "COMMENTED", body: QUOTA_BODY },
      { user: copilot(), commit_id: OTHER, state: "COMMENTED", body: "older review" },
      { user: copilot(), commit_id: HEAD, state: "COMMENTED", body: "Looks good." },
    ],
  });
  assert.deepEqual(reviewed, { kind: "reviewed" });

  const pending = classifyCopilotActivity({
    headSha: HEAD,
    reviews: [{ user: copilot("copilot-pull-request-reviewer"), commit_id: OTHER, state: "COMMENTED", body: "old" }],
  });
  assert.equal(pending.kind, "pending");

  const quota = classifyCopilotActivity({
    headSha: HEAD,
    reviews: [{ user: copilot(), commit_id: HEAD, state: "COMMENTED", body: QUOTA_BODY }],
  });
  assert.equal(quota.kind, "unavailable");
  assert.equal(quota.source, "review");

  const inline = classifyCopilotActivity({
    headSha: HEAD,
    reviewComments: [{ user: copilot(), commit_id: HEAD, body: "Premium requests exhausted" }],
  });
  assert.equal(inline.source, "review-comment");

  const ignoredOldIssue = classifyCopilotActivity({
    headSha: HEAD,
    issueComments: [{ user: copilot(), body: QUOTA_BODY, created_at: "2026-10-01T00:00:00Z" }],
    requestedAtMs: Date.parse("2026-10-27T00:00:00Z"),
  });
  assert.equal(ignoredOldIssue.kind, "pending");

  const freshIssue = classifyCopilotActivity({
    headSha: HEAD,
    issueComments: [{ user: copilot(), body: "Out of credit", created_at: "2026-10-27T00:01:00Z" }],
    requestedAtMs: Date.parse("2026-10-27T00:00:00Z"),
  });
  assert.equal(freshIssue.source, "issue-comment");

  const pendingReview = classifyCopilotActivity({
    headSha: HEAD,
    reviews: [{ user: copilot(), commit_id: HEAD, state: "PENDING", body: "" }],
  });
  assert.equal(pendingReview.kind, "pending");
});

test("bugbot dedup follows timeline order, not committer dates", () => {
  const timeline = [
    { event: "committed", sha: OTHER, committer: { date: "2026-10-27T12:00:00Z" } },
    { event: "commented", id: 1, body: "bugbot run\n", created_at: "2026-10-27T11:00:00Z" },
    { event: "committed", sha: HEAD, committer: { date: "2026-10-26T00:00:00Z" } },
  ];
  assert.deepEqual(bugbotAlreadyRequestedForHead({ headSha: HEAD, timeline }), { known: true, requested: false });
  timeline.push({ event: "commented", id: 2, body: "please bugbot run" });
  assert.equal(bugbotAlreadyRequestedForHead({ headSha: HEAD, timeline }).requested, false);
  timeline.push({ event: "head_ref_force_pushed", after: HEAD });
  timeline.push({ event: "commented", id: 3, body: BUGBOT_COMMENT_BODY });
  assert.equal(bugbotAlreadyRequestedForHead({ headSha: HEAD, timeline }).requested, true);
  assert.equal(bugbotAlreadyRequestedForHead({ headSha: "cccccccccccccccccccccccccccccccccccccccc", timeline }).known, false);
});

test("bugbot dedup can match a later timeline comment id to its issue comment", () => {
  const decision = bugbotAlreadyRequestedForHead({
    headSha: HEAD,
    timeline: [
      { event: "committed", sha: HEAD },
      { event: "commented", id: 9 },
    ],
    issueComments: [{ id: 9, body: "bugbot run" }],
  });
  assert.deepEqual(decision, { known: true, requested: true });
  assert.equal(isExactBugbotBody("bugbot run"), true);
  assert.equal(isExactBugbotBody("bugbot run\r\n"), true);
  assert.equal(isExactBugbotBody("bugbot run please"), false);
});

test("missing token exits successfully and never calls GitHub", async () => {
  const github = fakeGithub();
  const result = await runReviewFallback({
    token: "  ",
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    github,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.outcome, "skipped-no-token");
  assert.equal(github.calls.length, 0);
  assert.match(result.logs[0], /^::notice title=Review fallback::/);
  assert.match(result.logs[0], /REVIEW_TRIGGER_TOKEN/);
  assert.match(result.summary, new RegExp(`<!-- review-fallback: outcome=skipped-no-token sha=${HEAD} -->`));
});

test("a real Copilot review exits without posting bugbot", async () => {
  const github = fakeGithub({
    reviewsByCall: [
      [],
      [{ user: copilot(), commit_id: HEAD, state: "COMMENTED", body: "No issues." }],
    ],
  });
  const time = clock();
  const result = await runReviewFallback({
    token: TOKEN,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD.toUpperCase(),
    pollIntervalSeconds: 30,
    pollTimeoutSeconds: 600,
    github,
    sleep: time.sleep,
    now: time.now,
  });
  assert.equal(result.outcome, "copilot-reviewed");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(postedBodies(github), []);
  assert.equal(github.calls[0].body.reviewers[0], COPILOT_REVIEWER);
  assert.match(result.summary, new RegExp(`outcome=copilot-reviewed sha=${HEAD}`));
  assert.equal(result.summary.includes(TOKEN), false);
});

test("non-2xx Copilot requests fall back immediately", async () => {
  const github = fakeGithub({
    postStatus: 402,
    postBody: { message: "You have exceeded your monthly quota" },
    timeline: [{ event: "committed", sha: HEAD }],
  });
  const result = await runReviewFallback({
    token: TOKEN,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    github,
  });
  assert.equal(result.outcome, "bugbot-triggered");
  assert.deepEqual(postedBodies(github), [BUGBOT_COMMENT_BODY]);
  assert.equal(github.calls.some((call) => call.path.includes("/reviews?")), false);
  assert.match(result.summary, /HTTP 402/);
  assert.match(result.summary, /<!-- review-fallback: outcome=bugbot-triggered sha=/);
  assert.equal(result.logs.join("\n").includes(TOKEN), false);
});

test("a quota review skips the rest of the wait and does not double-post", async () => {
  const github = fakeGithub({
    reviews: [{ user: copilot(), commit_id: HEAD, state: "COMMENTED", body: QUOTA_BODY }],
    timeline: [
      { event: "committed", sha: HEAD },
      { event: "commented", id: 4, body: BUGBOT_COMMENT_BODY },
    ],
  });
  const time = clock();
  let slept = 0;
  const result = await runReviewFallback({
    token: TOKEN,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    pollIntervalSeconds: 30,
    pollTimeoutSeconds: 600,
    github,
    now: time.now,
    sleep: async (ms) => {
      slept += ms;
      await time.sleep(ms);
    },
  });
  assert.equal(slept, 0);
  assert.equal(result.outcome, "bugbot-already-requested");
  assert.deepEqual(postedBodies(github), []);
  assert.match(result.summary, /usage, quota, or credit limit/);
});

test("timeout is the fallback signal when Copilot never reviews", async () => {
  const github = fakeGithub({ timeline: [{ event: "committed", sha: HEAD }] });
  const time = clock();
  const result = await runReviewFallback({
    token: TOKEN,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    pollIntervalSeconds: 30,
    pollTimeoutSeconds: 60,
    github,
    sleep: time.sleep,
    now: time.now,
  });
  assert.equal(result.outcome, "bugbot-triggered");
  assert.match(result.reason, /after 60s/);
  assert.deepEqual(postedBodies(github), ["bugbot run"]);
  const reviewGets = github.calls.filter((call) => call.path.includes("/reviews?"));
  assert.equal(reviewGets.length, 3);
});

test("read failures do not post bugbot", async () => {
  const github = {
    calls: [],
    async request(method, path, body) {
      this.calls.push({ method, path, body });
      if (method === "POST") return { status: 201, body: {} };
      throw new Error(`network down ${TOKEN}`);
    },
  };
  const result = await runReviewFallback({
    token: TOKEN,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    github,
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.outcome, "failed");
  assert.deepEqual(postedBodies(github), []);
  assert.equal(result.summary.includes(TOKEN), false);
  assert.match(result.logs[0], /\[redacted\]/);
});

test("an unknown head does not add a second bugbot comment when one already exists", async () => {
  const github = fakeGithub({
    postStatus: 403,
    postBody: { message: "Resource not accessible by integration" },
    issueComments: [{ id: 3, body: "bugbot run" }],
    timeline: [{ event: "committed", sha: OTHER }],
  });
  const result = await runReviewFallback({
    token: TOKEN,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    github,
  });
  assert.equal(result.outcome, "bugbot-skipped-uncertain");
  assert.match(result.summary, /timeline did not include/);
  assert.deepEqual(postedBodies(github), []);
});

test("GitHub client uses the documented review request", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return { status: 201, text: async () => JSON.stringify({ ok: true }) };
  };
  const client = createGithubClient({
    token: TOKEN,
    repo: "jorgeasaurus/EndpointJobs",
    fetchImpl,
    apiBase: "https://api.github.com/",
  });
  const response = await client.request("POST", "/pulls/12/requested_reviewers", {
    reviewers: [COPILOT_REVIEWER],
  });
  assert.equal(response.status, 201);
  assert.equal(seen[0].url, "https://api.github.com/repos/jorgeasaurus/EndpointJobs/pulls/12/requested_reviewers");
  assert.equal(seen[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(seen[0].init.headers["X-GitHub-Api-Version"], "2026-03-10");
  assert.equal(seen[0].init.headers.Accept, "application/vnd.github+json");
  assert.deepEqual(JSON.parse(seen[0].init.body), { reviewers: [COPILOT_REVIEWER] });
  assert.equal(seen[0].url.includes(TOKEN), false);
});

test("secrets are redacted and the summary marker stays out of the comment", () => {
  assert.equal(redact(`bearer ${TOKEN} and ${TOKEN}`, TOKEN).includes(TOKEN), false);
  const summary = renderSummary({ outcome: "bugbot-triggered", headSha: HEAD, detail: "HTTP 403" });
  assert.match(summary, /<!-- review-fallback: outcome=bugbot-triggered sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -->/);
  assert.equal(summary.includes("sha=") && summary.split("bugbot run").length >= 1, true);
  assert.equal(BUGBOT_COMMENT_BODY, "bugbot run");
});

test("config clamps the poll interval and preserves an explicit timeout", () => {
  const config = readConfig({
    REVIEW_TRIGGER_TOKEN: TOKEN,
    GITHUB_REPOSITORY: "jorgeasaurus/EndpointJobs",
    PR_NUMBER: "4",
    HEAD_SHA: HEAD,
    POLL_INTERVAL_SECONDS: "0",
    POLL_TIMEOUT_SECONDS: "15",
  });
  assert.equal(config.pollIntervalSeconds, 1);
  assert.equal(config.pollTimeoutSeconds, 15);
  assert.equal(readConfig({}).pollTimeoutSeconds, 600);
});

test("main writes the job summary and returns 0 when the secret is missing", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "review-fallback-"));
  const summaryPath = path.join(directory, "summary.md");
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    const code = await main({
      REVIEW_TRIGGER_TOKEN: "",
      GITHUB_STEP_SUMMARY: summaryPath,
      PR_NUMBER: "4",
      HEAD_SHA: HEAD,
      GITHUB_REPOSITORY: "jorgeasaurus/EndpointJobs",
    });
    assert.equal(code, 0);
  } finally {
    console.log = original;
  }
  const summary = await readFile(summaryPath, "utf8");
  assert.match(summary, /REVIEW_TRIGGER_TOKEN/);
  assert.match(lines[0], /^::notice /);
});

test("workflow contract", () => {
  const yaml = readFileSync(new URL("../../.github/workflows/review-fallback.yml", import.meta.url), "utf8");
  assert.match(yaml, /types: \[opened, synchronize, reopened, ready_for_review\]/);
  assert.match(yaml, /group: review-fallback-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(yaml, /cancel-in-progress: true/);
  assert.match(yaml, /contents: read/);
  assert.match(yaml, /pull-requests: read/);
  assert.match(yaml, /github\.event\.pull_request\.draft == false/);
  assert.match(yaml, /github\.event\.pull_request\.head\.sha/);
  assert.match(yaml, /REVIEW_TRIGGER_TOKEN: \$\{\{ secrets\.REVIEW_TRIGGER_TOKEN \}\}/);
  assert.match(yaml, /POLL_INTERVAL_SECONDS: "30"/);
  assert.match(yaml, /POLL_TIMEOUT_SECONDS: "600"/);
  assert.match(yaml, /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4\.2\.2/);
  assert.doesNotMatch(yaml, /secrets\.GITHUB_TOKEN/);
  assert.doesNotMatch(yaml, /github\.token/);
});
