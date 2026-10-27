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
const fixtureReviewCredential = "fixture-review-trigger";
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
  commitStatus = 200,
  commitBody,
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
      if (method === "GET" && path.startsWith("/commits/")) {
        if (commitStatus !== 200) return { status: commitStatus, body: commitBody ?? { message: "missing commit" } };
        return {
          status: 200,
          body: commitBody ?? {
            sha: path.slice("/commits/".length),
            commit: { committer: { date: "1970-01-01T00:00:00Z" } },
          },
        };
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

test("bugbot dedup follows push time when commit order and push order differ", () => {
  const headPushedAtMs = Date.parse("2026-10-27T12:00:00Z");
  // Authored at 10:00, pushed at 12:00. A timeline sorted by commit date places
  // this head before the 11:00 comment, which would treat the old comment as covering it.
  const timelineByCommitDate = [
    { event: "committed", sha: HEAD, committer: { date: "2026-10-27T10:00:00Z" } },
    { event: "commented", id: 1, body: "bugbot run", created_at: "2026-10-27T11:00:00Z" },
  ];
  const commitIndex = timelineByCommitDate.findIndex((event) => event.sha === HEAD);
  const commentIndex = timelineByCommitDate.findIndex((event) => event.created_at === "2026-10-27T11:00:00Z");
  assert.ok(commitIndex < commentIndex);

  assert.deepEqual(
    bugbotAlreadyRequestedForHead({
      issueComments: [{ id: 1, body: "bugbot run\n", created_at: "2026-10-27T11:00:00Z" }],
      headPushedAtMs,
    }),
    { known: true, requested: false },
  );
  assert.deepEqual(
    bugbotAlreadyRequestedForHead({
      issueComments: [{ id: 2, body: "please bugbot run", created_at: "2026-10-27T12:30:00Z" }],
      headPushedAtMs,
    }),
    { known: true, requested: false },
  );
  assert.deepEqual(
    bugbotAlreadyRequestedForHead({
      issueComments: [{ id: 3, body: BUGBOT_COMMENT_BODY, created_at: "2026-10-27T12:00:00Z" }],
      headPushedAtMs,
    }),
    { known: true, requested: true },
  );
  assert.deepEqual(bugbotAlreadyRequestedForHead({ issueComments: [], headPushedAtMs: "not-a-time" }), {
    known: false,
    requested: false,
  });
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
    token: fixtureReviewCredential,
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
  assert.equal(result.summary.includes(fixtureReviewCredential), false);
});

test("non-2xx Copilot requests fall back immediately", async () => {
  const github = fakeGithub({
    postStatus: 402,
    postBody: { message: "You have exceeded your monthly quota" },
    timeline: [{ event: "committed", sha: HEAD }],
  });
  const result = await runReviewFallback({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    github,
  });
  assert.equal(result.outcome, "bugbot-triggered");
  assert.deepEqual(postedBodies(github), [BUGBOT_COMMENT_BODY]);
  assert.equal(postedBodies(github).some((body) => body.includes("review-fallback:")), false);
  assert.equal(github.calls.some((call) => call.path.includes("/reviews?")), false);
  assert.match(result.summary, /HTTP 402/);
  assert.match(result.summary, /<!-- review-fallback: outcome=bugbot-triggered sha=/);
  assert.equal(result.logs.join("\n").includes(fixtureReviewCredential), false);
});

test("a quota review skips the rest of the wait and does not double-post", async () => {
  const github = fakeGithub({
    reviews: [{ user: copilot(), commit_id: HEAD, state: "COMMENTED", body: QUOTA_BODY }],
    issueComments: [{ id: 4, body: BUGBOT_COMMENT_BODY, created_at: "2026-10-27T10:05:00Z" }],
  });
  const time = clock();
  let slept = 0;
  const result = await runReviewFallback({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    pollIntervalSeconds: 30,
    pollTimeoutSeconds: 600,
    headPushedAt: "2026-10-27T10:00:00Z",
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
    token: fixtureReviewCredential,
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

test("poll read errors keep waiting until the deadline", async () => {
  const time = clock();
  let gets = 0;
  const github = {
    calls: [],
    async request(method, path, body) {
      this.calls.push({ method, path, body });
      if (method === "POST" && path.endsWith("/requested_reviewers")) return { status: 201, body: {} };
      if (method === "POST" && path.endsWith("/comments")) return { status: 201, body: { id: 1, body: body?.body ?? "" } };
      gets += 1;
      if (gets <= 6) return { status: 502, body: { message: `Bad gateway ${fixtureReviewCredential}` } };
      return { status: 200, body: [] };
    },
  };
  const result = await runReviewFallback({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    pollIntervalSeconds: 30,
    pollTimeoutSeconds: 60,
    github,
    sleep: time.sleep,
    now: time.now,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.outcome, "bugbot-triggered");
  assert.deepEqual(postedBodies(github), [BUGBOT_COMMENT_BODY]);
  assert.equal(postedBodies(github).some((body) => body.includes("review-fallback:")), false);
  assert.ok(result.logs.some((line) => line.includes("Copilot poll read failed") && line.includes("HTTP 502")));
  assert.equal(result.logs.join("\n").includes(fixtureReviewCredential), false);
  const reviewGets = github.calls.filter((call) => call.method === "GET" && call.path.includes("/reviews?"));
  assert.ok(reviewGets.length >= 3);
});

test("a failed dedup read does not post bugbot", async () => {
  let commentGets = 0;
  const github = {
    calls: [],
    async request(method, path, body) {
      this.calls.push({ method, path, body });
      if (method === "POST" && path.endsWith("/requested_reviewers")) return { status: 201, body: {} };
      if (method === "POST") return { status: 201, body: { id: 1, body: body?.body ?? "" } };
      if (path.includes("/issues/") && path.includes("/comments?")) {
        commentGets += 1;
        if (commentGets > 1) return { status: 403, body: { message: "secondary rate limit" } };
      }
      return { status: 200, body: [] };
    },
  };
  const result = await runReviewFallback({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    pollIntervalSeconds: 30,
    pollTimeoutSeconds: 0,
    github,
    now: () => 1_000,
    sleep: async () => {
      throw new Error("sleep should not run when the deadline has already passed");
    },
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.outcome, "failed");
  assert.deepEqual(postedBodies(github), []);
  assert.match(result.logs.join("\n"), /HTTP 403/);
});

function commitAuthoredAt(date) {
  return { sha: HEAD, commit: { committer: { date } } };
}

test("synchronize and opened ignore a bugbot comment from before the push", async () => {
  const earlier = [{ id: 3, body: "bugbot run", created_at: "2026-10-27T11:00:00Z" }];
  for (const action of ["synchronize", "opened"]) {
    const github = fakeGithub({
      postStatus: 402,
      postBody: { message: "quota" },
      issueComments: earlier,
    });
    const result = await runReviewFallback({
      token: fixtureReviewCredential,
      repo: "jorgeasaurus/EndpointJobs",
      prNumber: "12",
      headSha: HEAD,
      headPushedAt: "2026-10-27T12:00:00Z",
      action,
      github,
    });
    assert.equal(result.outcome, "bugbot-triggered", action);
    assert.deepEqual(postedBodies(github), [BUGBOT_COMMENT_BODY], action);
    assert.equal(
      github.calls.some((call) => call.path.startsWith("/commits/")),
      false,
      action,
    );
  }
});

test("ready_for_review and reopened post when the bugbot comment predates the head commit", async () => {
  const earlier = [{ id: 3, body: "bugbot run", created_at: "2026-10-27T11:00:00Z" }];
  for (const action of ["ready_for_review", "reopened"]) {
    const github = fakeGithub({
      postStatus: 402,
      postBody: { message: "quota" },
      issueComments: earlier,
      commitBody: commitAuthoredAt("2026-10-27T12:00:00Z"),
    });
    const result = await runReviewFallback({
      token: fixtureReviewCredential,
      repo: "jorgeasaurus/EndpointJobs",
      prNumber: "12",
      headSha: HEAD,
      headPushedAt: "2026-10-27T10:00:00Z",
      action,
      github,
    });
    assert.equal(result.outcome, "bugbot-triggered", action);
    assert.deepEqual(postedBodies(github), [BUGBOT_COMMENT_BODY], action);
    assert.ok(
      github.calls.some((call) => call.method === "GET" && call.path === `/commits/${HEAD}`),
      action,
    );
  }
});

test("ready_for_review and reopened skip a bugbot comment at or after the head commit", async () => {
  const cases = [
    ["ready_for_review", "2026-10-27T11:00:00Z"],
    ["reopened", "2026-10-27T11:30:00Z"],
  ];
  for (const [action, createdAt] of cases) {
    const github = fakeGithub({
      postStatus: 402,
      postBody: { message: "quota" },
      issueComments: [{ id: 3, body: "bugbot run", created_at: createdAt }],
      commitBody: commitAuthoredAt("2026-10-27T11:00:00Z"),
    });
    const result = await runReviewFallback({
      token: fixtureReviewCredential,
      repo: "jorgeasaurus/EndpointJobs",
      prNumber: "12",
      headSha: HEAD,
      headPushedAt: "2026-10-27T13:00:00Z",
      action,
      github,
    });
    assert.equal(result.outcome, "bugbot-already-requested", action);
    assert.deepEqual(postedBodies(github), [], action);
    assert.ok(
      github.calls.some((call) => call.method === "GET" && call.path === `/commits/${HEAD}`),
      action,
    );
  }
});

test("reopened with no bugbot comment still posts", async () => {
  const firstFallback = fakeGithub({ postStatus: 402, postBody: { message: "quota" } });
  const fresh = await runReviewFallback({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    headPushedAt: "2026-10-27T12:00:00Z",
    action: "reopened",
    github: firstFallback,
  });
  assert.equal(fresh.outcome, "bugbot-triggered");
  assert.deepEqual(postedBodies(firstFallback), [BUGBOT_COMMENT_BODY]);
});

test("a failed head commit read does not post bugbot", async () => {
  const github = fakeGithub({
    postStatus: 402,
    postBody: { message: "quota" },
    commitStatus: 404,
    commitBody: { message: "Not Found" },
  });
  const result = await runReviewFallback({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    pollTimeoutSeconds: 0,
    headPushedAt: "2026-10-27T12:00:00Z",
    action: "ready_for_review",
    github,
    now: () => 1_000,
    sleep: async () => {
      throw new Error("sleep should not run when the deadline has already passed");
    },
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.outcome, "failed");
  assert.deepEqual(postedBodies(github), []);
  assert.match(result.logs.join("\n"), /GET \/commits\/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa failed/);
});

test("an earlier bugbot comment does not cover a head pushed later", async () => {
  const github = fakeGithub({
    postStatus: 403,
    postBody: { message: "Resource not accessible by integration" },
    issueComments: [{ id: 3, body: "bugbot run", created_at: "2026-10-27T11:00:00Z" }],
  });
  const result = await runReviewFallback({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    prNumber: "12",
    headSha: HEAD,
    headPushedAt: "2026-10-27T12:00:00Z",
    github,
  });
  assert.equal(result.outcome, "bugbot-triggered");
  assert.deepEqual(postedBodies(github), [BUGBOT_COMMENT_BODY]);
  assert.equal(postedBodies(github).some((body) => body.includes("review-fallback:")), false);
});

test("GitHub client uses the documented review request", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return { status: 201, text: async () => JSON.stringify({ ok: true }) };
  };
  const client = createGithubClient({
    token: fixtureReviewCredential,
    repo: "jorgeasaurus/EndpointJobs",
    fetchImpl,
    apiBase: "https://api.github.com/",
  });
  const response = await client.request("POST", "/pulls/12/requested_reviewers", {
    reviewers: [COPILOT_REVIEWER],
  });
  assert.equal(response.status, 201);
  assert.equal(seen[0].url, "https://api.github.com/repos/jorgeasaurus/EndpointJobs/pulls/12/requested_reviewers");
  assert.equal(seen[0].init.headers.Authorization, `Bearer ${fixtureReviewCredential}`);
  assert.equal(seen[0].init.headers["X-GitHub-Api-Version"], "2026-03-10");
  assert.equal(seen[0].init.headers.Accept, "application/vnd.github+json");
  assert.deepEqual(JSON.parse(seen[0].init.body), { reviewers: [COPILOT_REVIEWER] });
  assert.equal(seen[0].url.includes(fixtureReviewCredential), false);
});

test("fixture credentials are redacted", () => {
  assert.equal(redact(`bearer ${fixtureReviewCredential} and ${fixtureReviewCredential}`, fixtureReviewCredential).includes(fixtureReviewCredential), false);
  const shapedLikeAPat = ["github", "pat", "fixturevalue"].join("_");
  assert.equal(redact(shapedLikeAPat, "").includes(shapedLikeAPat), false);
  const summary = renderSummary({ outcome: "bugbot-triggered", headSha: HEAD, detail: "HTTP 403" });
  assert.match(summary, /<!-- review-fallback: outcome=bugbot-triggered sha=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -->/);
  assert.equal(summary.includes(fixtureReviewCredential), false);
});

test("config clamps the poll interval and preserves an explicit timeout", () => {
  const config = readConfig({
    REVIEW_TRIGGER_TOKEN: fixtureReviewCredential,
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
  assert.match(yaml, /HEAD_PUSHED_AT: \$\{\{ github\.event\.pull_request\.updated_at \}\}/);
  assert.match(yaml, /PR_ACTION: \$\{\{ github\.event\.action \}\}/);
  assert.match(yaml, /REVIEW_TRIGGER_TOKEN: \$\{\{ secrets\.REVIEW_TRIGGER_TOKEN \}\}/);
  assert.match(yaml, /POLL_INTERVAL_SECONDS: "30"/);
  assert.match(yaml, /POLL_TIMEOUT_SECONDS: "600"/);
  assert.match(yaml, /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4\.2\.2/);
  assert.doesNotMatch(yaml, /secrets\.GITHUB_TOKEN/);
  assert.doesNotMatch(yaml, /github\.token/);
});
