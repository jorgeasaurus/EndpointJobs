import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { runReviewFallback } from "./logic.mjs";

export function readConfig(env) {
  const interval = Number(env.POLL_INTERVAL_SECONDS ?? 30);
  const timeout = Number(env.POLL_TIMEOUT_SECONDS ?? 600);
  return {
    token: typeof env.REVIEW_TRIGGER_TOKEN === "string" ? env.REVIEW_TRIGGER_TOKEN : "",
    repo: env.GITHUB_REPOSITORY ?? "",
    prNumber: env.PR_NUMBER ?? "",
    headSha: env.HEAD_SHA ?? "",
    headPushedAt: typeof env.HEAD_PUSHED_AT === "string" ? env.HEAD_PUSHED_AT : "",
    action: typeof env.PR_ACTION === "string" ? env.PR_ACTION : "",
    pollIntervalSeconds: Number.isFinite(interval) ? Math.max(1, interval) : 30,
    pollTimeoutSeconds: Number.isFinite(timeout) && timeout >= 0 ? timeout : 600,
  };
}

export async function main(env = process.env, overrides = {}) {
  const result = await runReviewFallback({ ...readConfig(env), ...overrides });
  if (env.GITHUB_STEP_SUMMARY && result.summary) {
    await appendFile(env.GITHUB_STEP_SUMMARY, `${result.summary}\n`);
  }
  for (const line of result.logs ?? []) console.log(line);
  return result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exit(code);
  });
}
