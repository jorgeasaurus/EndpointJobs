import type { Job } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import { defaultWorkdaySites, type WorkdaySite } from "./workday-sites";
import {
  addDays,
  buildProviderJobId,
  buildStableJobId,
  cleanText,
  containsAlias,
  getJobStaleDays,
  getPositiveInteger,
  inferWorkplace,
  normalizeEmploymentTypeLabel,
  normalizeSearchText,
  parseStrictIsoDate,
  stripHtml,
  toEndpointJob,
} from "../shared";

type WorkdayJob = {
  title?: string;
  externalPath?: string;
  postedOn?: string;
  bulletFields?: string[];
  locationsText?: string;
  detail?: {
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    startDate?: string;
    endDate?: string;
    canApply?: boolean;
    posted?: boolean;
    remoteType?: string;
    timeType?: string;
  };
};

const staleDays = getJobStaleDays();
const workdayDetailConcurrency = 5;

export const workdayProvider = {
  id: "workday",
  displayName: "Workday",
  defaultUrl:
    "https://accenture.wd103.myworkdayjobs.com/wday/cxs/accenture/AccentureCareers/jobs",
  fetchJobs: ({ url, fetchedAt }) => fetchWorkdayJobs(url, fetchedAt),
} as const satisfies ProviderAdapter<"workday">;

export class WorkdayIncompleteSnapshotError extends Error {
  constructor(site: string, operation: string, cause: unknown) {
    super(
      `Workday/${site} ${operation} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = "WorkdayIncompleteSnapshotError";
  }
}

export class WorkdayDetailError extends WorkdayIncompleteSnapshotError {
  constructor(site: string, path: string, cause: unknown) {
    super(site, `detail ${path}`, cause);
    this.name = "WorkdayDetailError";
  }
}

async function fetchWorkdayJobs(url: string, fetchedAt: Date) {
  let sites: WorkdaySite[];
  try {
    sites = getWorkdaySites(url);
  } catch (error) {
    throw new WorkdayIncompleteSnapshotError("configuration", "parsing", error);
  }
  const deadline = sites.some((site) => site.fetchDetails)
    ? Date.now() + 120_000
    : undefined;
  const jobs: Array<Job | null> = [];
  let completedQueries = 0;

  for (const site of sites) {
    const seenPaths = new Set<string>();
    for (const query of site.queries) {
      let payload: WorkdayJob[];
      try {
        payload = await fetchWorkdaySearch(
          site.url,
          query,
          site.fetchDetails,
          deadline,
        );
        assertWorkdayDeadline(deadline);
      } catch (error) {
        if (
          site.fetchDetails ||
          (deadline !== undefined && Date.now() >= deadline)
        ) {
          throw new WorkdayIncompleteSnapshotError(
            site.name,
            `query ${query}`,
            error,
          );
        }
        console.warn(
          `Skipping Workday/${site.name} query ${query}: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      completedQueries += 1;
      const uniqueJobs = payload.filter(
        (job): job is WorkdayJob & { externalPath: string } => {
          if (!job.externalPath || seenPaths.has(job.externalPath))
            return false;
          seenPaths.add(job.externalPath);
          return true;
        },
      );
      for (
        let offset = 0;
        offset < uniqueJobs.length;
        offset += workdayDetailConcurrency
      ) {
        const batch = uniqueJobs.slice(
          offset,
          offset + workdayDetailConcurrency,
        );
        const enrichedJobs = await Promise.all(
          batch.map(async (job) => {
            try {
              const enriched = site.fetchDetails
                ? await fetchWorkdayDetail(site.url, job, deadline)
                : job;
              assertWorkdayDeadline(deadline);
              return enriched
                ? normalizeWorkdayJob(enriched, site, query, fetchedAt)
                : null;
            } catch (error) {
              if (site.fetchDetails)
                throw new WorkdayDetailError(
                  site.name,
                  job.externalPath,
                  error,
                );
              if (deadline !== undefined && Date.now() >= deadline) {
                throw new WorkdayIncompleteSnapshotError(
                  site.name,
                  `query ${query}`,
                  error,
                );
              }
              throw error;
            }
          }),
        );
        jobs.push(...enrichedJobs);
        if (deadline !== undefined) assertWorkdayDeadline(deadline);
      }
      console.log(
        `Fetched ${payload.length} raw jobs from Workday/${site.name} query ${query}`,
      );
    }
  }

  if (completedQueries === 0) {
    throw new Error("No Workday queries completed successfully");
  }

  return jobs;
}

function assertWorkdayDeadline(deadline: number | undefined) {
  if (deadline !== undefined && Date.now() >= deadline)
    throw new Error("Workday snapshot exceeded its 120-second deadline");
}

function workdayRequestSignal(deadline: number | undefined) {
  const remaining = deadline === undefined ? 15_000 : deadline - Date.now();
  if (remaining <= 0)
    throw new Error("Workday snapshot exceeded its 120-second deadline");
  return AbortSignal.timeout(Math.min(15_000, remaining));
}

async function fetchWorkdaySearch(
  url: string,
  query: string,
  requireValidEntries = false,
  deadline?: number,
) {
  const limit = getPositiveInteger(
    process.env.JOB_WORKDAY_RESULTS_PER_QUERY,
    10,
  );
  const postings: WorkdayJob[] = [];
  const postingPaths = new Set<string>();
  let offset = 0;
  let reportedTotal: number | undefined;

  while (true) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        origin: new URL(url).origin,
        referer: new URL(url).origin,
        "user-agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit,
        offset,
        searchText: query,
      }),
      signal: workdayRequestSignal(deadline),
    });

    if (!response.ok) {
      throw new Error(
        `Workday request failed: ${response.status} ${response.statusText}`,
      );
    }

    const json: unknown = await response.json();

    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as { jobPostings?: unknown }).jobPostings)
    ) {
      throw new Error("Workday response did not include a jobPostings array");
    }

    const page = (json as { jobPostings: unknown[] }).jobPostings;
    if (
      requireValidEntries &&
      page.some(
        (entry) =>
          !isWorkdayJob(entry) ||
          typeof entry.title !== "string" ||
          !entry.title.trim() ||
          (entry.locationsText !== undefined &&
            typeof entry.locationsText !== "string") ||
          (entry.postedOn !== undefined && typeof entry.postedOn !== "string") ||
          (entry.bulletFields !== undefined &&
            (!Array.isArray(entry.bulletFields) ||
              entry.bulletFields.some((field) => typeof field !== "string"))) ||
          !isWorkdayDetailPath(entry.externalPath),
      )
    ) {
      throw new Error("Workday search included an invalid job posting");
    }

    if (requireValidEntries) {
      for (const entry of page as WorkdayJob[]) {
        const path = entry.externalPath as string;
        if (postingPaths.has(path)) {
          throw new Error(`Workday search repeated job path ${path}`);
        }
        postingPaths.add(path);
      }
    }

    postings.push(
      ...page.filter(
        (entry): entry is WorkdayJob =>
          isWorkdayJob(entry) && isWorkdayDetailPath(entry.externalPath),
      ),
    );

    const total = (json as { total?: unknown }).total;
    if (!requireValidEntries) return postings;
    if (
      !Number.isSafeInteger(total) ||
      (total as number) < offset + page.length ||
      (reportedTotal !== undefined && total !== reportedTotal)
    ) {
      throw new Error("Workday response included an invalid total");
    }
    reportedTotal = total as number;
    if (offset + page.length >= (total as number)) return postings;
    if (page.length === 0) {
      throw new Error("Workday search ended before its reported total");
    }

    offset += page.length;
    assertWorkdayDeadline(deadline);
  }
}

async function fetchWorkdayDetail(
  siteUrl: string,
  job: WorkdayJob,
  deadline?: number,
): Promise<WorkdayJob | null> {
  const url =
    siteUrl.replace(/\/+$/, "").replace(/\/jobs$/, "") + job.externalPath;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0",
    },
    signal: workdayRequestSignal(deadline),
  });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok)
    throw new Error(`Workday detail request failed: ${response.status}`);
  const payload: unknown = await response.json();
  const detail =
    payload && typeof payload === "object"
      ? (payload as { jobPostingInfo?: WorkdayJob["detail"] }).jobPostingInfo
      : undefined;
  if (
    !detail ||
    typeof detail !== "object" ||
    typeof detail.startDate !== "string" ||
    !parseStrictIsoDate(detail.startDate)
  ) {
    throw new Error("Workday detail did not include a valid job posting date");
  }
  for (const field of [
    "title",
    "jobDescription",
    "location",
    "remoteType",
    "timeType",
    "endDate",
  ] as const) {
    if (detail[field] != null && typeof detail[field] !== "string") {
      throw new TypeError(`Workday detail ${field} must be a string`);
    }
  }
  for (const field of ["canApply", "posted"] as const) {
    if (detail[field] != null && typeof detail[field] !== "boolean") {
      throw new TypeError(`Workday detail ${field} must be a boolean`);
    }
  }
  const closingDate = detail.endDate?.trim();
  if (closingDate && !parseStrictIsoDate(closingDate)) {
    throw new Error("Workday detail included an invalid closing date");
  }
  if (
    detail.additionalLocations != null &&
    (!Array.isArray(detail.additionalLocations) ||
      detail.additionalLocations.some(
        (location) => typeof location !== "string",
      ))
  ) {
    throw new TypeError("Workday detail locations must be an array of strings");
  }
  return {
    ...job,
    detail: {
      ...detail,
      startDate: detail.startDate.trim(),
      endDate: closingDate || undefined,
    },
  };
}

function normalizeWorkdayJob(
  raw: WorkdayJob,
  site: WorkdaySite,
  query: string,
  fetchedAt: Date,
): Job | null {
  const detail = raw.detail;
  const closingDate = detail?.endDate?.trim();
  const endDate = parseStrictIsoDate(closingDate);
  const expiresAt =
    endDate && /^\d{4}-\d{2}-\d{2}$/.test(closingDate ?? "")
      ? new Date(new Date(endDate).getTime() + 86_400_000 - 1).toISOString()
      : endDate;
  if (
    detail?.canApply === false ||
    detail?.posted === false ||
    (expiresAt && new Date(expiresAt) <= fetchedAt)
  )
    return null;
  const detailTitle = cleanText(detail?.title ?? "");
  const title = detailTitle || cleanText(raw.title);
  const company = site.name;
  const sourceJobUrl = buildWorkdayJobUrl(site.url, raw.externalPath);

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const bulletFields = Array.isArray(raw.bulletFields)
    ? raw.bulletFields.map(cleanText).filter(Boolean)
    : [];
  const detailLocations = detail
    ? [detail.location, ...(detail.additionalLocations ?? [])]
        .map((value) => cleanText(value ?? ""))
        .filter(Boolean)
    : [];
  const location = detailLocations.length > 0
    ? detailLocations.join("; ")
    : getWorkdayLocation(raw, bulletFields);
  const detailDescription = detail?.jobDescription
    ? stripHtml(detail.jobDescription).trim()
    : "";
  const description = detailDescription || bulletFields.join(" ");
  const haystack = normalizeSearchText(
    [
      title,
      company,
      location,
      bulletFields.join(" "),
      description,
      detail?.remoteType,
    ].join(" "),
  );
  const postedAt =
    parseStrictIsoDate(detail?.startDate) ??
    parseWorkdayPostedOn(raw.postedOn, fetchedAt) ??
    fetchedAt.toISOString();
  if (detail && new Date(postedAt) > fetchedAt) return null;
  const freshnessEnd = addDays(
    detail ? new Date(postedAt) : fetchedAt,
    staleDays,
  ).toISOString();
  const staleAfter =
    expiresAt && expiresAt < freshnessEnd ? expiresAt : freshnessEnd;
  if (new Date(staleAfter) <= fetchedAt) return null;

  const job = toEndpointJob({
    id: site.fetchDetails
      ? buildProviderJobId("workday", site.name, raw.externalPath, sourceJobUrl)
      : buildStableJobId("workday", site.name, title, sourceJobUrl),
    title,
    company,
    location,
    workplace: inferWorkdayWorkplace(location, haystack, detail?.remoteType),
    postedAt,
    fetchedAt,
    staleAfter,
    source: "Workday",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: `Workday / ${company}`,
    termsProfile: "public-api",
    description,
    descriptionFormat: "text",
    sourceTags: bulletFields,
    haystackParts: [detail?.remoteType],
    relevanceOnlyParts: detail ? [] : [query],
    employmentType: normalizeEmploymentTypeLabel(detail?.timeType),
  });
  return job && expiresAt ? { ...job, expiresAt } : job;
}

function inferWorkdayWorkplace(
  location: string,
  haystack: string,
  remoteType?: string,
): Job["workplace"] {
  const explicit = normalizeSearchText(remoteType ?? "");
  if (explicit === "hybrid") return "Hybrid";
  if (explicit === "remote") return "Remote";
  if (["on-site", "onsite", "on site"].includes(explicit)) return "On-site";
  if (
    /remote work available (?:once|twice|[1-4] days?) (?:a|per) week/.test(
      haystack,
    )
  )
    return "Hybrid";
  return inferWorkplace(location, haystack);
}

function parseWorkdayPostedOn(value: string | undefined, fetchedAt: Date) {
  const text = normalizeSearchText(value ?? "");

  if (!text) {
    return undefined;
  }

  if (
    containsAlias(text, "today") ||
    containsAlias(text, "yesterday") ||
    containsAlias(text, "just posted")
  ) {
    return containsAlias(text, "yesterday")
      ? addDays(fetchedAt, -1).toISOString()
      : fetchedAt.toISOString();
  }

  const match = text.match(/posted\s+(\d+)\+?\s+(day|week|month)s?\s+ago/);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const days =
    unit === "month" ? amount * 30 : unit === "week" ? amount * 7 : amount;

  return addDays(fetchedAt, -days).toISOString();
}

function getWorkdaySites(defaultUrl: string): WorkdaySite[] {
  const configured = process.env.JOB_WORKDAY_SITES;

  if (!configured) {
    return defaultWorkdaySites.map((site) => ({
      ...site,
      url: site.url || defaultUrl,
    }));
  }

  return configured
    .split(";;")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url, queries, fetchDetails] = entry.split("|");
      const normalizedName = cleanText(name);
      const normalizedUrl = cleanText(url);
      const normalizedQueries = queries
        ?.split(";")
        .map(cleanText)
        .filter(Boolean) ?? [];

      if (!normalizedName || !normalizedUrl || normalizedQueries.length === 0) {
        throw new Error(`Invalid JOB_WORKDAY_SITES entry: ${entry}`);
      }

      return {
        name: normalizedName,
        url: normalizedUrl,
        fetchDetails:
          fetchDetails === undefined
            ? defaultWorkdaySites.some(
                (site) =>
                  site.url.replace(/\/+$/, "") ===
                    normalizedUrl.replace(/\/+$/, "") &&
                  "fetchDetails" in site &&
                  site.fetchDetails,
              )
            : parseWorkdayFetchDetails(fetchDetails, entry),
        queries: normalizedQueries,
      };
    });
}

function parseWorkdayFetchDetails(value: string, entry: string) {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(
    `Invalid JOB_WORKDAY_SITES fetchDetails flag in entry: ${entry}`,
  );
}

function buildWorkdayJobUrl(siteUrl: string, externalPath: string | undefined) {
  if (!externalPath) {
    return undefined;
  }

  try {
    const url = new URL(siteUrl);
    const [, sitePath] =
      url.pathname.match(/\/wday\/cxs\/[^/]+\/([^/]+)\/jobs/) ?? [];
    const visibleSitePath = sitePath ? `/${sitePath}` : "";
    return new URL(`${visibleSitePath}${externalPath}`, url.origin).toString();
  } catch {
    return undefined;
  }
}

function getWorkdayLocation(raw: WorkdayJob, bulletFields: string[]) {
  const reportedLocation =
    cleanText(raw.locationsText) ||
    bulletFields.find((field) => !/^[A-Z0-9-]+$/.test(field)) ||
    "";

  if (reportedLocation && !isWorkdayLocationCount(reportedLocation)) {
    return reportedLocation;
  }

  return (
    parseWorkdayLocationFromExternalPath(raw.externalPath) || reportedLocation
  );
}

function isWorkdayLocationCount(value: string) {
  return /^\d+ locations$/i.test(value);
}

function parseWorkdayLocationFromExternalPath(
  externalPath: string | undefined,
) {
  if (!externalPath) {
    return "";
  }

  const segments = decodeURIComponent(externalPath)
    .split("/")
    .map(cleanText)
    .filter(Boolean);
  const jobSegmentIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === "job",
  );
  const locationSlug =
    jobSegmentIndex >= 0 ? segments[jobSegmentIndex + 1] : "";

  if (!locationSlug) {
    return "";
  }

  return formatWorkdayLocationSlug(locationSlug);
}

function formatWorkdayLocationSlug(slug: string) {
  const parts = slug
    .replace(/_/g, "-")
    .split("-")
    .map(cleanText)
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  const locationParts = dropLeadingCountryCode(parts);
  const firstState = getStateCode(locationParts[0]);

  if (firstState && locationParts.length > 1) {
    return `${toTitleCase(locationParts.slice(1).join(" "))}, ${firstState}`;
  }

  const trailingState = getTrailingStateCode(locationParts);

  if (trailingState && locationParts.length > trailingState.partCount) {
    return `${toTitleCase(locationParts.slice(0, -trailingState.partCount).join(" "))}, ${
      trailingState.code
    }`;
  }

  return toTitleCase(locationParts.join(" "));
}

function dropLeadingCountryCode(parts: string[]) {
  const [first, ...rest] = parts;
  return first && /^(us|usa)$/i.test(first) && rest.length > 0 ? rest : parts;
}

function getStateCode(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  const stateCode = stateNameToCode[normalized];

  if (stateCode) {
    return stateCode;
  }

  return /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : undefined;
}

function getTrailingStateCode(parts: string[]) {
  for (const partCount of [3, 2, 1]) {
    const stateName = parts.slice(-partCount).join(" ").toLowerCase();
    const code = stateNameToCode[stateName];

    if (code) {
      return { code, partCount };
    }

    if (partCount === 1) {
      const stateCode = getStateCode(parts[parts.length - 1]);

      if (stateCode) {
        return { code: stateCode, partCount };
      }
    }
  }

  return undefined;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

const stateNameToCode: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function isWorkdayJob(value: unknown): value is WorkdayJob {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkdayJob;
  return Boolean(candidate.title && candidate.externalPath);
}

function isWorkdayDetailPath(value: unknown) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    !value.startsWith("/job/")
  )
    return false;
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(value);
  } catch {
    return false;
  }
  const parsed = new URL(value, "https://workday.invalid");
  const detailSegments = decodedPath.slice("/job/".length).split("/");
  return (
    parsed.pathname === value &&
    !parsed.search &&
    !parsed.hash &&
    !/[?#\\]/.test(decodedPath) &&
    decodedPath.startsWith("/job/") &&
    detailSegments.length > 0 &&
    detailSegments.every(Boolean) &&
    !decodedPath
      .split("/")
      .some((segment) => segment === "." || segment === "..")
  );
}
