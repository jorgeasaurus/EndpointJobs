import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  addDays,
  buildStableJobId,
  cleanText,
  cleanUrl,
  deriveTools,
  getCsvConfig,
  isEndpointRelevant,
  normalizeEmploymentTypeLabel,
  normalizeSearchText,
  parseDateLike,
  toEndpointJob
} from "../shared";

type SmartRecruitersLabel = {
  id?: string | number;
  label?: string;
  description?: string;
};

type SmartRecruitersLocation = {
  city?: string;
  region?: string;
  country?: string;
  fullLocation?: string;
  remote?: boolean;
  hybrid?: boolean;
  hybridDescription?: string;
};

type SmartRecruitersCustomField = {
  fieldLabel?: string;
  valueLabel?: string;
};

type SmartRecruitersSection = {
  title?: string;
  text?: string;
};

type SmartRecruitersPosting = {
  id?: string;
  uuid?: string;
  name?: string;
  ref?: string;
  applyUrl?: string;
  releasedDate?: string;
  company?: {
    name?: string;
    identifier?: string;
  };
  location?: SmartRecruitersLocation;
  department?: SmartRecruitersLabel;
  function?: SmartRecruitersLabel;
  typeOfEmployment?: SmartRecruitersLabel;
  experienceLevel?: SmartRecruitersLabel;
  customField?: SmartRecruitersCustomField[];
  jobAd?: {
    sections?: Record<string, SmartRecruitersSection>;
  };
};

type SmartRecruitersPage = {
  content: SmartRecruitersPosting[];
  limit: number;
  offset: number;
  totalFound: number;
};

const defaultCompanies = ["Continental", "BoschGroup"];
const defaultQueries = [
  "endpoint",
  "intune",
  "jamf",
  "sccm",
  "end user computing",
  "desktop engineer",
  "client environment",
  "client platform",
  "windows client",
  "macos client",
  "mobile device management",
  "unified endpoint",
  "digital workplace"
];
const defaultPageLimit = 100;
const defaultMaxPages = 3;
const staleDays = getPositiveInteger(process.env.JOB_STALE_DAYS, 45);

export const smartRecruitersProvider: ProviderAdapter<"smartrecruiters"> = {
  id: "smartrecruiters",
  displayName: "SmartRecruiters",
  defaultUrl: "https://api.smartrecruiters.com/v1/companies",
  fetchJobs: ({ url, fetchedAt }) => fetchSmartRecruitersJobs(url, fetchedAt)
};

async function fetchSmartRecruitersJobs(baseUrl: string, fetchedAt: Date) {
  const companies = getCsvConfig("JOB_SMARTRECRUITERS_COMPANIES", defaultCompanies);
  const queries = getCsvConfig("JOB_SMARTRECRUITERS_QUERIES", defaultQueries);
  const pageLimit = Math.min(
    100,
    getPositiveInteger(process.env.JOB_SMARTRECRUITERS_PAGE_LIMIT, defaultPageLimit)
  );
  const maxPages = getPositiveInteger(
    process.env.JOB_SMARTRECRUITERS_MAX_PAGES,
    defaultMaxPages
  );
  const jobs: Array<Job | null> = [];
  let successfulCompanies = 0;

  for (const company of companies) {
    const postings = new Map<string, SmartRecruitersPosting>();
    let successfulQueries = 0;

    for (const query of queries) {
      try {
        const queryPostings = await fetchSmartRecruitersQuery(
          baseUrl,
          company,
          query,
          pageLimit,
          maxPages
        );
        successfulQueries += 1;

        for (const posting of queryPostings) {
          const postingId = getPostingId(posting);

          if (
            postingId
            && isFreshPosting(posting, fetchedAt)
            && isPromisingListPosting(posting)
          ) {
            postings.set(postingId, posting);
          }
        }

        console.log(
          `Fetched ${queryPostings.length} raw jobs from SmartRecruiters/${company} query ${query}`
        );
      } catch (error) {
        console.warn(
          `Skipping SmartRecruiters/${company} query ${query}: ${formatError(error)}`
        );
      }
    }

    if (successfulQueries === 0) {
      console.warn(`Skipping SmartRecruiters/${company}: all queries failed`);
      continue;
    }

    successfulCompanies += 1;

    for (const posting of postings.values()) {
      const postingId = getPostingId(posting);

      if (!postingId) {
        continue;
      }

      try {
        const detail = await fetchSmartRecruitersDetail(baseUrl, company, postingId);
        jobs.push(normalizeSmartRecruitersPosting({ ...posting, ...detail }, company, fetchedAt));
      } catch (error) {
        console.warn(
          `Skipping SmartRecruiters/${company}/${postingId} detail: ${formatError(error)}`
        );
        jobs.push(normalizeSmartRecruitersPosting(posting, company, fetchedAt));
      }
    }
  }

  if (successfulCompanies === 0) {
    throw new Error("No SmartRecruiters companies returned jobs");
  }

  return jobs;
}

async function fetchSmartRecruitersQuery(
  baseUrl: string,
  company: string,
  query: string,
  pageLimit: number,
  maxPages: number
) {
  const postings: SmartRecruitersPosting[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageLimit;
    const pageUrl = buildSmartRecruitersListUrl(baseUrl, company, query, pageLimit, offset);
    const payload = await fetchSmartRecruitersPage(pageUrl, company);
    postings.push(...payload.content);

    const nextOffset = payload.offset + payload.content.length;

    if (payload.content.length === 0 || nextOffset >= payload.totalFound) {
      break;
    }
  }

  return postings;
}

async function fetchSmartRecruitersPage(url: string, company: string) {
  const response = await fetch(url, { headers: getRequestHeaders() });

  if (!response.ok) {
    throw new Error(
      `SmartRecruiters ${company} request failed: ${response.status} ${response.statusText}`
    );
  }

  const json: unknown = await response.json();

  if (!isSmartRecruitersPage(json)) {
    throw new Error(`SmartRecruiters ${company} response was not a posting list`);
  }

  return json;
}

async function fetchSmartRecruitersDetail(
  baseUrl: string,
  company: string,
  postingId: string
) {
  const detailUrl = buildSmartRecruitersDetailUrl(baseUrl, company, postingId);
  const response = await fetch(detailUrl, { headers: getRequestHeaders() });

  if (!response.ok) {
    throw new Error(
      `SmartRecruiters detail request failed: ${response.status} ${response.statusText}`
    );
  }

  const json: unknown = await response.json();

  if (!isSmartRecruitersPosting(json)) {
    throw new Error("SmartRecruiters detail response was not a posting");
  }

  return json;
}

function normalizeSmartRecruitersPosting(
  raw: SmartRecruitersPosting,
  companyIdentifier: string,
  fetchedAt: Date
) {
  const postingId = getPostingId(raw);
  const title = cleanText(raw.name);
  const company = cleanText(raw.company?.name) || formatCompanyIdentifier(companyIdentifier);
  const sourceJobUrl = cleanUrl(raw.applyUrl) ?? buildSmartRecruitersJobUrl(
    raw.company?.identifier ?? companyIdentifier,
    postingId,
    title
  );

  if (!postingId || !title || !company || !sourceJobUrl) {
    return null;
  }

  const postedAt = parseDateLike(raw.releasedDate) ?? fetchedAt.toISOString();

  if (new Date(postedAt).getTime() < addDays(fetchedAt, -staleDays).getTime()) {
    return null;
  }

  const location = formatLocation(raw.location);
  const sourceTags = [
    raw.department?.label,
    raw.function?.label,
    raw.typeOfEmployment?.label,
    raw.experienceLevel?.label,
    raw.location?.hybridDescription,
    ...(raw.customField ?? []).map((field) => field.valueLabel)
  ].map(cleanText).filter(Boolean);

  return toEndpointJob({
    id: buildStableJobId("smartrecruiters", companyIdentifier, title, sourceJobUrl),
    title,
    company,
    location,
    workplace: normalizeWorkplace(raw.location),
    postedAt,
    fetchedAt,
    staleAfter: addDays(new Date(postedAt), staleDays).toISOString(),
    source: "SmartRecruiters",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: `SmartRecruiters / ${company}`,
    termsProfile: "public-api",
    description: getFullDescription(raw.jobAd?.sections),
    sourceTags,
    employmentType: normalizeEmploymentTypeLabel(raw.typeOfEmployment?.label)
  });
}

function getFullDescription(sections: Record<string, SmartRecruitersSection> | undefined) {
  if (!sections) {
    return undefined;
  }

  const preferredOrder = [
    "jobDescription",
    "qualifications",
    "additionalInformation",
    "companyDescription"
  ];
  const orderedKeys = [
    ...preferredOrder.filter((key) => sections[key]),
    ...Object.keys(sections).filter((key) => !preferredOrder.includes(key))
  ];

  return orderedKeys
    .map((key) => {
      const section = sections[key];
      const title = cleanText(section?.title);
      const text = section?.text?.trim();

      if (!text) {
        return "";
      }

      return title ? `<h2>${title}</h2>${text}` : text;
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildSmartRecruitersListUrl(
  baseUrl: string,
  company: string,
  query: string,
  limit: number,
  offset: number
) {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(company)}/postings`);

  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("destination", "PUBLIC");

  return url.toString();
}

function buildSmartRecruitersDetailUrl(
  baseUrl: string,
  company: string,
  postingId: string
) {
  return `${baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(company)}/postings/${encodeURIComponent(postingId)}`;
}

function buildSmartRecruitersJobUrl(
  company: string,
  postingId: string,
  title: string
) {
  if (!company || !postingId || !title) {
    return undefined;
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanUrl(
    `https://jobs.smartrecruiters.com/${encodeURIComponent(company)}/${encodeURIComponent(postingId)}-${slug}`
  );
}

function formatLocation(location: SmartRecruitersLocation | undefined) {
  const fullLocation = cleanText(location?.fullLocation).replace(/,\s*,/g, ",");

  if (fullLocation) {
    return fullLocation;
  }

  return [location?.city, location?.region, location?.country]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");
}

function normalizeWorkplace(location: SmartRecruitersLocation | undefined): Workplace {
  if (location?.remote) return "Remote";
  if (location?.hybrid) return "Hybrid";
  if (formatLocation(location)) return "On-site";
  return "Unknown";
}

function getPostingId(posting: SmartRecruitersPosting) {
  return cleanText(posting.id ?? posting.uuid);
}

function isFreshPosting(posting: SmartRecruitersPosting, fetchedAt: Date) {
  const releasedDate = parseDateLike(posting.releasedDate);

  return !releasedDate || new Date(releasedDate).getTime() >= addDays(fetchedAt, -staleDays).getTime();
}

function isPromisingListPosting(posting: SmartRecruitersPosting) {
  const title = cleanText(posting.name);
  const listText = normalizeSearchText([
    title,
    posting.department?.label,
    posting.function?.label,
    posting.typeOfEmployment?.label,
    posting.experienceLevel?.label
  ].join(" "));
  const tools = deriveTools(listText);

  if (isEndpointRelevant(listText, title, tools)) {
    return true;
  }

  const normalizedTitle = normalizeSearchText(title);
  const clientTitleSignals = [
    "client environment",
    "windows client",
    "mobile device",
    "managed devices"
  ];
  const technicalTitleSignals = [
    "administrator",
    "architect",
    "engineer",
    "expert",
    "lead",
    "manager",
    "specialist"
  ];

  return clientTitleSignals.some((signal) => normalizedTitle.includes(signal))
    && technicalTitleSignals.some((signal) => normalizedTitle.includes(signal));
}

function getRequestHeaders() {
  const apiKey = process.env.SMARTRECRUITERS_API_KEY
    ?? process.env.JOB_SMARTRECRUITERS_API_KEY;

  return {
    accept: "application/json",
    "user-agent": "EndpointJobs/1.0 (+https://github.com/jorgeasaurus/EndpointJobs)",
    ...(apiKey ? { "x-smarttoken": apiKey } : {})
  };
}

function isSmartRecruitersPage(value: unknown): value is SmartRecruitersPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as {
    content?: unknown;
    limit?: unknown;
    offset?: unknown;
    totalFound?: unknown;
  };

  return Array.isArray(candidate.content)
    && candidate.content.every(isSmartRecruitersPosting)
    && typeof candidate.limit === "number"
    && typeof candidate.offset === "number"
    && typeof candidate.totalFound === "number";
}

function isSmartRecruitersPosting(value: unknown): value is SmartRecruitersPosting {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const posting = value as SmartRecruitersPosting;
  return Boolean((posting.id || posting.uuid) && posting.name);
}

function formatCompanyIdentifier(value: string) {
  return cleanText(value.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
