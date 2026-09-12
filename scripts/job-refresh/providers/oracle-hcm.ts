import type { Job, Workplace } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import {
  addDays,
  buildStableJobId,
  cleanText,
  getJobStaleDays,
  normalizeEmploymentTypeLabel,
  parseDateLike,
  stripHtml,
  toEndpointJob
} from "../shared";

type OracleRequisition = {
  Id: string;
  Title: string;
  ExternalPostedStartDate?: string;
  ExternalPostedEndDate?: string;
  ExternalDescriptionStr?: string;
  ExternalQualificationsStr?: string;
  ExternalResponsibilitiesStr?: string;
  PrimaryLocation?: string;
  WorkplaceType?: string;
  JobSchedule?: string;
};

const publicOrigin = "https://fa-etum-saasfaprod1.fa.ocs.oraclecloud.com";
const site = { number: "floridablue", company: "Florida Blue" };
const queries = ["macOS", "Jamf", "Intune", "endpoint"];
const pageSize = 25;
const maxPages = 3;
const maxDetails = 50;
const providerTimeoutMs = 60_000;

export class OracleHcmIncompleteSnapshotError extends Error {
  constructor(cause: unknown) {
    super(`Oracle HCM incomplete snapshot: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "OracleHcmIncompleteSnapshotError";
  }
}

export const oracleHcmProvider: ProviderAdapter<"oraclehcm"> = {
  id: "oraclehcm",
  displayName: "Oracle HCM",
  defaultUrl: `${publicOrigin}/hcmRestApi/resources/latest`,
  fetchJobs: async ({ url, fetchedAt }) => {
    try {
      return await fetchOracleJobs(url, fetchedAt);
    } catch (error) {
      throw new OracleHcmIncompleteSnapshotError(error);
    }
  }
};

async function fetchOracleJobs(url: string, fetchedAt: Date): Promise<Job[]> {
  const apiBaseUrl = url.replace(/\/+$/, "");
  const deadline = Date.now() + providerTimeoutMs;
  const ids = new Set<string>();
  // Fail the provider on incomplete searches, rather than publishing a partial source snapshot.
  for (const query of queries) {
    for (let page = 0; page < maxPages; page += 1) {
      const searchUrl = new URL(`${apiBaseUrl}/recruitingCEJobRequisitions`);
      searchUrl.searchParams.set("onlyData", "true");
      searchUrl.searchParams.set("expand", "requisitionList");
      searchUrl.searchParams.set("finder", `findReqs;siteNumber=${site.number},keyword=${query},limit=${pageSize},offset=${page * pageSize}`);
      const payload = await requestItems(searchUrl, deadline);
      const result = payload?.[0];
      if (!isRecord(result) || !Array.isArray(result.requisitionList)
        || typeof result.TotalJobsCount !== "number") {
        throw new Error("Oracle HCM search did not include requisitionList and TotalJobsCount");
      }
      for (const raw of result.requisitionList) {
        if (!isRequisition(raw)) throw new Error("Oracle HCM search included a malformed requisition");
        ids.add(raw.Id);
        if (ids.size > maxDetails) {
          throw new Error(`Oracle HCM exceeded the ${maxDetails} detail result bound`);
        }
      }
      if ((page + 1) * pageSize >= result.TotalJobsCount) break;
      if (page === maxPages - 1) {
        throw new Error(`Oracle HCM query ${query} exceeded the ${pageSize * maxPages} result bound`);
      }
    }
  }
  const jobs: Job[] = [];
  for (const id of ids) {
    const detailUrl = new URL(`${apiBaseUrl}/recruitingCEJobRequisitionDetails`);
    detailUrl.searchParams.set("onlyData", "true");
    detailUrl.searchParams.set("finder", `ById;Id=${id}`);
    const payload = await requestItems(detailUrl, deadline, { allowMissing: true });
    // A requisition can close between search and detail requests.
    if (payload === null) continue;
    const detail = payload.find((item) => isRequisition(item) && item.Id === id);
    if (!isRequisition(detail)) throw new Error(`Oracle HCM missing detail for ${id}`);
    const job = normalizeOracleRequisition(detail, fetchedAt);
    if (job) jobs.push(job);
  }
  return jobs;
}

async function requestItems(url: URL, deadline: number, { allowMissing = false } = {}): Promise<unknown[] | null> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new Error("Oracle HCM exceeded the 60 second provider deadline");
  const response = await fetch(url, {
    headers: { accept: "application/json", "accept-language": "en-US" },
    signal: AbortSignal.timeout(Math.min(20_000, remainingMs))
  });
  if (Date.now() >= deadline) throw new Error("Oracle HCM exceeded the 60 second provider deadline");
  if (allowMissing && (response.status === 404 || response.status === 410)) return null;
  if (!response.ok) throw new Error(`Oracle HCM request failed: ${response.status}`);
  const body: unknown = await response.json();
  if (Date.now() >= deadline) throw new Error("Oracle HCM exceeded the 60 second provider deadline");
  if (!isRecord(body) || !Array.isArray(body.items)) {
    throw new Error("Oracle HCM response did not include items");
  }
  return body.items;
}

function normalizeOracleRequisition(raw: OracleRequisition, fetchedAt: Date): Job | null {
  const postedAt = parseDateLike(raw.ExternalPostedStartDate);
  const closingDate = raw.ExternalPostedEndDate;
  if (closingDate != null && typeof closingDate !== "string") {
    throw new Error(`Oracle HCM invalid closing date for ${raw.Id}`);
  }
  const closesAt = parseDateLike(closingDate?.trim());
  if (closingDate?.trim() && !closesAt) {
    throw new Error(`Oracle HCM invalid closing date for ${raw.Id}`);
  }
  const description = [raw.ExternalDescriptionStr, raw.ExternalResponsibilitiesStr, raw.ExternalQualificationsStr]
    .map((value) => typeof value === "string" ? stripHtml(value).trim() : "").filter(Boolean).join("\n\n");
  // Never manufacture publication dates or replace unavailable employer details with search snippets.
  if (!postedAt || !description || new Date(postedAt) > fetchedAt) return null;
  const staleDays = getJobStaleDays();
  const freshnessEnd = addDays(new Date(postedAt), staleDays).toISOString();
  const staleAfter = closesAt && closesAt < freshnessEnd ? closesAt : freshnessEnd;
  if (new Date(staleAfter) <= fetchedAt) return null;
  const sourceUrl = new URL(`/hcmUI/CandidateExperience/en/sites/${site.number}/job/${encodeURIComponent(raw.Id)}`, publicOrigin).toString();
  const workplace: Workplace | undefined = raw.WorkplaceType === "Hybrid" ? "Hybrid"
    : raw.WorkplaceType === "Remote" ? "Remote"
    : raw.WorkplaceType === "On-site" ? "On-site" : undefined;
  const job = toEndpointJob({
    id: buildStableJobId("oraclehcm", site.number, raw.Id, sourceUrl),
    title: cleanText(raw.Title),
    company: site.company,
    location: cleanText(raw.PrimaryLocation),
    workplace,
    postedAt,
    fetchedAt,
    staleAfter,
    source: "Oracle HCM",
    sourceUrl,
    applyUrl: sourceUrl,
    attributionLabel: site.company,
    termsProfile: "public-api",
    description,
    descriptionFormat: "text",
    employmentType: normalizeEmploymentTypeLabel(raw.JobSchedule)
  });
  // Preserve the actual closing timestamp independently of feed freshness.
  return job ? { ...job, ...(closesAt ? { expiresAt: closesAt } : {}) } : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isRequisition(value: unknown): value is OracleRequisition {
  return isRecord(value) && typeof value.Id === "string" && /^\d+$/.test(value.Id)
    && typeof value.Title === "string" && Boolean(value.Title.trim());
}
