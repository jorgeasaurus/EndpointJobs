export type ProviderProbe = {
  provider: "workday" | "greenhouse" | "lever" | "recruitee";
  url: string;
  jobId?: string;
};

export type ProviderResult = {
  status: "ok" | "dead" | "unverified";
  reason: string;
};

/** Use public job-detail APIs where the HTML page can be only an application shell. */
export function getProviderProbe(value: string): ProviderProbe | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname;
  const path = url.pathname;
  const workday = host.match(/^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/);
  const workdayPath = path.match(/^\/(?:[a-z]{2}-[A-Z]{2}\/)?([a-zA-Z0-9_-]+)(\/job\/.+?)(?:\/apply)?\/?$/);
  if (workday && workdayPath) {
    return {
      provider: "workday",
      url: `https://${host}/wday/cxs/${workday[1]}/${workdayPath[1]}${workdayPath[2]}`,
    };
  }
  const greenhousePath = path.match(/^\/([a-zA-Z0-9_-]+)\/jobs\/(\d+)\/?$/);
  if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(host) && greenhousePath) {
    return {
      provider: "greenhouse",
      url: `https://boards-api.greenhouse.io/v1/boards/${greenhousePath[1]}/jobs/${greenhousePath[2]}`,
      jobId: greenhousePath[2],
    };
  }
  const leverPath = path.match(/^\/([a-zA-Z0-9_-]+)\/([a-f0-9-]{36})(?:\/apply)?\/?$/i);
  if (["jobs.lever.co", "jobs.eu.lever.co"].includes(host) && leverPath) {
    return {
      provider: "lever",
      url: `https://${host === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co"}/v0/postings/${leverPath[1]}/${leverPath[2]}`,
      jobId: leverPath[2],
    };
  }
  const recruiteePath = path.match(/^\/o\/([a-zA-Z0-9_-]+)(?:\/c\/new)?\/?$/);
  if (/^[a-z0-9-]+\.recruitee\.com$/.test(host) && recruiteePath) {
    return {
      provider: "recruitee",
      url: `https://${host}/api/offers/${recruiteePath[1]}`,
      jobId: recruiteePath[1],
    };
  }
  return null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Never interpret a challenge page, authorization failure, or malformed payload as a dead job. */
export function classifyProviderPayload(probe: ProviderProbe, status: number, body: string): ProviderResult {
  const unknown: ProviderResult = { status: "unverified", reason: `${probe.provider} response did not verify the posting` };
  let payload: Record<string, unknown> | null;
  try {
    payload = record(JSON.parse(body));
  } catch {
    return unknown;
  }
  if (!payload) return unknown;
  if (status === 404 || status === 410) {
    const absent =
      (probe.provider === "workday" && payload.httpStatus === status && typeof payload.message === "string" && payload.message.startsWith("not found: Job_Posting_Anchor_ID=")) ||
      (probe.provider === "greenhouse" && payload.status === status && payload.error === "Job not found") ||
      (probe.provider === "lever" && payload.ok === false && payload.error === "Document not found") ||
      (probe.provider === "recruitee" && payload.error === "Not Found");
    return absent ? { status: "dead", reason: `${probe.provider} job API confirms posting not found (${status})` } : unknown;
  }
  if (status < 200 || status >= 300) return unknown;
  if (probe.provider === "workday") {
    const job = record(payload.jobPostingInfo);
    if (!job || typeof job.title !== "string" || typeof job.id !== "string") return unknown;
    if (job.canApply === false || job.posted === false) return { status: "dead", reason: "Workday reports posting closed or applications disabled" };
    if (job.canApply === true && job.posted === true) return { status: "ok", reason: "Workday confirms posted job accepts applications" };
    return unknown;
  }
  if (probe.provider === "greenhouse" && String(payload.id) === probe.jobId && typeof payload.title === "string") {
    return { status: "ok", reason: "Greenhouse public job API contains the posting" };
  }
  if (probe.provider === "lever" && payload.id === probe.jobId && typeof payload.text === "string") {
    return { status: "ok", reason: "Lever public job API contains the posting" };
  }
  if (probe.provider === "recruitee") {
    const job = record(payload.offer);
    if (job && job.slug === probe.jobId && typeof job.title === "string" && job.status === "published") {
      return { status: "ok", reason: "Recruitee confirms published posting" };
    }
  }
  return unknown;
}
