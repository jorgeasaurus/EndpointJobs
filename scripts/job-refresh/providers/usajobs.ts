import type { Job } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  buildStableJobId,
  cleanText,
  cleanUrl,
  getCsvConfig,
  inferWorkplace,
  normalizeFirstEmploymentType,
  normalizeSalary,
  parseDateLike,
  summarize,
  toArray,
  toEndpointJob
} from "../shared";

type UsaJobsLabel = {
  Name?: string;
  Code?: string;
};

type UsaJobsLocation = {
  LocationName?: string;
  CountryCode?: string;
  CountrySubDivisionCode?: string;
  CityName?: string;
  Longitude?: number;
  Latitude?: number;
};

type UsaJobsRemuneration = {
  MinimumRange?: string | number;
  MaximumRange?: string | number;
  RateIntervalCode?: string;
  Description?: string;
};

type UsaJobsDetails = {
  MajorDuties?: string;
  Education?: string;
  Requirements?: string;
  Evaluations?: string;
  Benefits?: string;
  OtherInformation?: string;
  KeyRequirements?: unknown[];
  JobSummary?: string;
  WhoMayApply?: UsaJobsLabel;
  LowGrade?: string;
  HighGrade?: string;
  RemoteIndicator?: boolean | string;
};

type UsaJobsDescriptor = {
  PositionID?: string;
  PositionTitle?: string;
  PositionURI?: string;
  ApplyURI?: string | string[];
  PositionLocationDisplay?: string;
  PositionLocation?: UsaJobsLocation[];
  OrganizationName?: string;
  DepartmentName?: string;
  JobCategory?: UsaJobsLabel[];
  JobGrade?: UsaJobsLabel[];
  PositionSchedule?: UsaJobsLabel[];
  PositionOfferingType?: UsaJobsLabel[];
  QualificationSummary?: string;
  PositionRemuneration?: UsaJobsRemuneration[];
  PositionStartDate?: string;
  PositionEndDate?: string;
  PublicationStartDate?: string;
  ApplicationCloseDate?: string;
  PositionFormattedDescription?: Array<{
    Content?: string;
    Label?: string;
    LabelDescription?: string;
  }>;
  RemoteIndicator?: boolean | string;
  UserArea?: {
    Details?: UsaJobsDetails;
  };
};

type UsaJobsSearchItem = {
  MatchedObjectId?: string | number;
  MatchedObjectDescriptor?: UsaJobsDescriptor;
};

type UsaJobsSearchPage = {
  SearchResult: {
    SearchResultItems: UsaJobsSearchItem[];
    UserArea?: {
      NumberOfPages?: string | number;
    };
  };
};

const defaultQueries = [
  "endpoint management",
  "endpoint engineer",
  "desktop engineer",
  "end user computing",
  "Intune",
  "mobile device management",
  "client platform"
];

export const usaJobsProvider: ProviderAdapter<"usajobs"> = {
  id: "usajobs",
  displayName: "USAJOBS",
  defaultUrl: "https://data.usajobs.gov/api/search",
  fetchJobs: ({ url, fetchedAt }) => fetchUsaJobs(url, fetchedAt)
};

async function fetchUsaJobs(baseUrl: string, fetchedAt: Date) {
  const apiKey = process.env.USAJOBS_API_KEY ?? process.env.JOB_USAJOBS_API_KEY;
  const userAgentEmail = process.env.USAJOBS_USER_AGENT_EMAIL
    ?? process.env.JOB_USAJOBS_USER_AGENT_EMAIL
    ?? process.env.USAJOBS_EMAIL;

  if (!apiKey || !userAgentEmail) {
    throw new Error(
      "USAJOBS credentials are required: set USAJOBS_API_KEY or JOB_USAJOBS_API_KEY, "
      + "and USAJOBS_USER_AGENT_EMAIL, JOB_USAJOBS_USER_AGENT_EMAIL, or USAJOBS_EMAIL"
    );
  }

  const queries = getCsvConfig("JOB_USAJOBS_QUERIES", defaultQueries);
  const datePostedDays = getBoundedInteger(process.env.JOB_USAJOBS_DATE_POSTED_DAYS, 30, 0, 60);
  const resultsPerPage = getBoundedInteger(process.env.JOB_USAJOBS_RESULTS_PER_PAGE, 100, 1, 500);
  const maxPages = getBoundedInteger(process.env.JOB_USAJOBS_MAX_PAGES, 3, 1, 100);
  const jobs: Array<Job | null> = [];

  for (const query of queries) {
    for (let page = 1; page <= maxPages; page += 1) {
      const requestUrl = buildSearchUrl(baseUrl, query, datePostedDays, resultsPerPage, page);
      const payload = await fetchSearchPage(requestUrl, apiKey, userAgentEmail);

      console.log(`Fetched ${payload.SearchResult.SearchResultItems.length} raw jobs from USAJOBS query ${query} page ${page}`);
      jobs.push(
        ...payload.SearchResult.SearchResultItems.map((item) =>
          normalizeUsaJobsItem(item, fetchedAt)
        )
      );

      const totalPages = getBoundedInteger(
        String(payload.SearchResult.UserArea?.NumberOfPages ?? 1),
        1,
        1,
        maxPages
      );

      if (page >= totalPages) {
        break;
      }
    }
  }

  return jobs;
}

export function normalizeUsaJobsItem(item: UsaJobsSearchItem, fetchedAt: Date) {
  const descriptor = item.MatchedObjectDescriptor;

  if (!descriptor) {
    return null;
  }

  const title = cleanText(descriptor.PositionTitle);
  const company = cleanText(descriptor.OrganizationName)
    || cleanText(descriptor.DepartmentName);
  const sourceUrl = cleanUrl(descriptor.PositionURI);
  const applyUrl = toArray(descriptor.ApplyURI)
    .map((value) => cleanUrl(value))
    .find(Boolean) ?? sourceUrl;

  if (!title || !company || !sourceUrl || !applyUrl) {
    return null;
  }

  const expiresAt = parseDateLike(
    descriptor.ApplicationCloseDate ?? descriptor.PositionEndDate
  );

  if (expiresAt && new Date(expiresAt).getTime() <= fetchedAt.getTime()) {
    return null;
  }

  const details = descriptor.UserArea?.Details;
  const location = getUsaJobsLocation(descriptor);
  const description = [
    details?.JobSummary,
    descriptor.QualificationSummary,
    details?.MajorDuties,
    details?.Requirements,
    ...toArray(details?.KeyRequirements).map(cleanText),
    details?.Education,
    details?.Evaluations,
    details?.OtherInformation,
    ...toArray(descriptor.PositionFormattedDescription).map((section) => section.Content)
  ]
    .map(cleanText)
    .filter(Boolean)
    .join("\n\n");
  const sourceTags = [
    descriptor.DepartmentName,
    ...getLabels(descriptor.JobCategory),
    ...getLabels(descriptor.JobGrade),
    ...getLabels(descriptor.PositionSchedule),
    ...getLabels(descriptor.PositionOfferingType),
    details?.WhoMayApply?.Name,
    formatGradeRange(details)
  ]
    .map(cleanText)
    .filter(Boolean);
  const postedAt = parseDateLike(
    descriptor.PublicationStartDate ?? descriptor.PositionStartDate
  ) ?? fetchedAt.toISOString();
  const remote = parseBoolean(
    descriptor.RemoteIndicator ?? details?.RemoteIndicator
  );

  return toEndpointJob({
    id: buildStableJobId(
      "usajobs",
      company,
      title,
      cleanText(descriptor.PositionID ?? String(item.MatchedObjectId ?? sourceUrl))
    ),
    title,
    company,
    location,
    workplace: remote === true ? "Remote" : inferWorkplace(location, description),
    postedAt,
    fetchedAt,
    ...(expiresAt ? { staleAfter: expiresAt } : {}),
    source: "USAJOBS",
    sourceUrl,
    applyUrl,
    attributionLabel: "USAJOBS",
    termsProfile: "public-api",
    description,
    sourceTags,
    haystackParts: sourceTags,
    salary: normalizeUsaJobsSalary(descriptor.PositionRemuneration),
    employmentType: normalizeFirstEmploymentType(
      toArray(descriptor.PositionSchedule).map((schedule) => schedule.Name)
    )
  });
}

function getUsaJobsLocation(descriptor: UsaJobsDescriptor) {
  const display = cleanText(descriptor.PositionLocationDisplay);

  if (display) {
    return display;
  }

  const locations = toArray(descriptor.PositionLocation)
    .map((location) => cleanText(
      location.LocationName
      ?? [location.CityName, location.CountrySubDivisionCode, location.CountryCode]
        .filter(Boolean)
        .join(", ")
    ))
    .filter(Boolean);

  return Array.from(new Set(locations)).slice(0, 3).join("; ");
}

function normalizeUsaJobsSalary(remuneration: UsaJobsRemuneration[] | undefined) {
  const annual = toArray(remuneration).find((range) => {
    const interval = cleanText(`${range.RateIntervalCode ?? ""} ${range.Description ?? ""}`)
      .toLowerCase();
    return interval.includes("pa") || interval.includes("per year") || interval.includes("annual");
  });

  if (!annual) {
    return undefined;
  }

  return normalizeSalary(
    toPositiveNumber(annual.MinimumRange),
    toPositiveNumber(annual.MaximumRange)
  );
}

function getLabels(values: UsaJobsLabel[] | undefined) {
  return toArray(values).flatMap((value) => [value.Name, value.Code]).filter(Boolean);
}

function formatGradeRange(details: UsaJobsDetails | undefined) {
  if (!details?.LowGrade && !details?.HighGrade) {
    return "";
  }

  return `Grade ${details.LowGrade ?? details.HighGrade}-${details.HighGrade ?? details.LowGrade}`;
}

function parseBoolean(value: boolean | string | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  return value?.trim().toLowerCase() === "true";
}

function toPositiveNumber(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildSearchUrl(
  baseUrl: string,
  query: string,
  datePostedDays: number,
  resultsPerPage: number,
  page: number
) {
  const url = new URL(baseUrl);

  url.searchParams.set("Keyword", query);
  url.searchParams.set("JobCategoryCode", "2210");
  url.searchParams.set("DatePosted", String(datePostedDays));
  url.searchParams.set("ResultsPerPage", String(resultsPerPage));
  url.searchParams.set("Page", String(page));
  url.searchParams.set("Fields", "Full");
  url.searchParams.set("SortField", "opendate");
  url.searchParams.set("SortDirection", "desc");

  return url.toString();
}

async function fetchSearchPage(url: string, apiKey: string, userAgentEmail: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": userAgentEmail,
      "authorization-key": apiKey
    }
  });

  if (!response.ok) {
    const detail = summarize(cleanText(await response.text()));
    throw new Error(
      `USAJOBS request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`
    );
  }

  const payload: unknown = await response.json();

  if (!isSearchPage(payload)) {
    throw new Error("USAJOBS response did not include SearchResultItems");
  }

  return payload;
}

function isSearchPage(value: unknown): value is UsaJobsSearchPage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const searchResult = (value as { SearchResult?: unknown }).SearchResult;

  return Boolean(
    searchResult
    && typeof searchResult === "object"
    && Array.isArray((searchResult as { SearchResultItems?: unknown }).SearchResultItems)
  );
}

function getBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value || !/^\d+$/.test(value.trim())) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10)));
}
