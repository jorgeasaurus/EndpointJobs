import type { Job, Workplace } from "../../../src/types/job";

import type { ProviderAdapter } from "../provider";
import {
  addDays,
  buildStableJobId,
  cleanText,
  cleanUrl,
  formatSlugLabel,
  getCsvConfig,
  normalizeEmploymentTypeLabel,
  parseDateLike,
  toEndpointJob
} from "../shared";

type RecruiteeLocation = {
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

type RecruiteeSalary = {
  min?: number | string | null;
  max?: number | string | null;
  currency?: string | null;
  period?: string | null;
};

type RecruiteeTranslation = {
  description?: string;
  requirements?: string;
};

type RecruiteeOffer = {
  id?: number | string;
  guid?: string;
  slug?: string;
  title?: string;
  company_name?: string;
  status?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  close_at?: string | null;
  department?: string;
  category_code?: string;
  experience_code?: string;
  employment_type_code?: string;
  country_code?: string;
  location?: string;
  locations?: RecruiteeLocation[];
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  description?: string;
  requirements?: string;
  translations?: Record<string, RecruiteeTranslation>;
  careers_url?: string;
  careers_apply_url?: string;
  tags?: string[];
  salary?: RecruiteeSalary;
};

const defaultRecruiteeAccounts = [
  "callista",
  "swordtech",
  "foodji",
  "tytantechnologiesgmbh",
  "intersnackitkg",
  "envipco",
  "entyre"
];

const configuredStaleDays = Number(process.env.JOB_STALE_DAYS ?? 45);
const staleDays = Number.isFinite(configuredStaleDays) && configuredStaleDays > 0
  ? configuredStaleDays
  : 45;

export const recruiteeProvider: ProviderAdapter<"recruitee"> = {
  id: "recruitee",
  displayName: "Recruitee",
  defaultUrl: "https://{account}.recruitee.com/api/offers",
  fetchJobs: ({ url, fetchedAt }) => fetchRecruiteeJobs(url, fetchedAt)
};

async function fetchRecruiteeJobs(baseUrl: string, fetchedAt: Date) {
  const accounts = getCsvConfig("JOB_RECRUITEE_ACCOUNTS", defaultRecruiteeAccounts);
  const jobs: Array<Job | null> = [];
  let successfulAccounts = 0;

  for (const account of accounts) {
    try {
      const offers = await fetchRecruiteeAccount(buildRecruiteeAccountUrl(baseUrl, account), account);
      successfulAccounts += 1;
      jobs.push(...offers.map((offer) => normalizeRecruiteeOffer(offer, account, fetchedAt)));
      console.log(`Fetched ${offers.length} published jobs from Recruitee/${account}`);
    } catch (error) {
      console.warn(
        `Skipping Recruitee/${account}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (successfulAccounts === 0) {
    throw new Error("No Recruitee accounts returned jobs");
  }

  return jobs;
}

async function fetchRecruiteeAccount(url: string, account: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/jorgeasaurus/EndpointJobs)"
    }
  });

  if (!response.ok) {
    throw new Error(`Recruitee ${account} request failed: ${response.status} ${response.statusText}`);
  }

  const json: unknown = await response.json();

  if (!json || typeof json !== "object" || !Array.isArray((json as { offers?: unknown }).offers)) {
    throw new Error(`Recruitee ${account} response did not include an offers array`);
  }

  return (json as { offers: unknown[] }).offers
    .filter(isRecruiteeOffer)
    .filter((offer) => cleanText(offer.status).toLowerCase() === "published");
}

function normalizeRecruiteeOffer(
  raw: RecruiteeOffer,
  account: string,
  fetchedAt: Date
): Job | null {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company_name) || formatSlugLabel(account);
  const sourceJobUrl = getRecruiteeOfferUrl(raw, account);
  const applyUrl = cleanUrl(raw.careers_apply_url) ?? sourceJobUrl;

  if (!title || !company || !sourceJobUrl || !applyUrl) {
    return null;
  }

  const postedAt = parseDateLike(raw.published_at)
    ?? parseDateLike(raw.created_at)
    ?? parseDateLike(raw.updated_at)
    ?? fetchedAt.toISOString();
  const freshnessDeadline = addDays(new Date(postedAt), staleDays).toISOString();
  const closeAt = parseDateLike(raw.close_at ?? undefined);
  const staleAfter = getEarlierDate(freshnessDeadline, closeAt);

  if (new Date(staleAfter).getTime() < fetchedAt.getTime()) {
    return null;
  }

  const description = getRecruiteeDescription(raw);
  const location = getRecruiteeLocation(raw);
  const sourceTags = [
    raw.department,
    raw.category_code,
    raw.experience_code,
    raw.employment_type_code,
    raw.country_code,
    ...(Array.isArray(raw.tags) ? raw.tags : [])
  ].map(cleanText).filter(Boolean);

  return toEndpointJob({
    id: buildStableJobId("recruitee", account, title, sourceJobUrl),
    title,
    company,
    location,
    workplace: getRecruiteeWorkplace(raw),
    postedAt,
    fetchedAt,
    staleAfter,
    source: "Recruitee",
    sourceUrl: sourceJobUrl,
    applyUrl,
    attributionLabel: `Recruitee / ${company}`,
    termsProfile: "public-api",
    description,
    sourceTags,
    haystackParts: [
      raw.country_code,
      ...(Array.isArray(raw.locations) ? raw.locations : []).map(formatRecruiteeLocation)
    ],
    salary: normalizeRecruiteeSalary(raw.salary),
    employmentType: normalizeEmploymentTypeLabel(raw.employment_type_code)
  });
}

function buildRecruiteeAccountUrl(baseUrl: string, account: string) {
  if (baseUrl.includes("{account}")) {
    return baseUrl.replace("{account}", encodeURIComponent(account));
  }

  const url = new URL(baseUrl);

  if (url.hostname === "recruitee.com" || url.hostname === "www.recruitee.com") {
    url.hostname = `${account}.recruitee.com`;
  }

  return url.toString();
}

function getRecruiteeOfferUrl(raw: RecruiteeOffer, account: string) {
  const directUrl = cleanUrl(raw.careers_url);

  if (directUrl) {
    return directUrl;
  }

  const slug = cleanText(raw.slug);
  return slug
    ? `https://${encodeURIComponent(account)}.recruitee.com/o/${encodeURIComponent(slug)}`
    : undefined;
}

function getRecruiteeDescription(raw: RecruiteeOffer) {
  const translated = Object.values(raw.translations ?? {}).find(
    (translation) => translation.description || translation.requirements
  );

  return [
    raw.description?.trim() ? raw.description : translated?.description,
    raw.requirements?.trim() ? raw.requirements : translated?.requirements
  ].filter(Boolean).join("\n\n");
}

function getRecruiteeLocation(raw: RecruiteeOffer) {
  const locations = (Array.isArray(raw.locations) ? raw.locations : [])
    .map(formatRecruiteeLocation)
    .filter(Boolean);

  if (locations.length > 1) {
    return Array.from(new Set(locations)).join("; ");
  }

  return cleanText(raw.location) || locations[0];
}

function formatRecruiteeLocation(location: RecruiteeLocation) {
  const parts = [location.city, location.state, location.country]
    .map(cleanText)
    .filter(Boolean);

  return Array.from(new Set(parts)).join(", ") || cleanText(location.name);
}

function getRecruiteeWorkplace(raw: RecruiteeOffer): Workplace | undefined {
  if (raw.remote) return "Remote";
  if (raw.hybrid) return "Hybrid";
  if (raw.on_site) return "On-site";
  return undefined;
}

function normalizeRecruiteeSalary(salary: RecruiteeSalary | undefined): Job["salary"] | undefined {
  const min = parsePositiveNumber(salary?.min);
  const max = parsePositiveNumber(salary?.max);
  const currency = cleanText(salary?.currency).toUpperCase();

  if ((!min && !max) || !/^[A-Z]{3}$/.test(currency)) {
    return undefined;
  }

  const format = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  });
  const label = min && max
    ? `${format.format(min)}-${format.format(max)}`
    : format.format(min ?? max ?? 0);
  const period = cleanText(salary?.period);

  return {
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
    currency,
    label: period ? `${label} / ${formatSlugLabel(period).toLowerCase()}` : label
  };
}

function parsePositiveNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getEarlierDate(first: string, second: string | undefined) {
  if (!second) {
    return first;
  }

  return new Date(second).getTime() < new Date(first).getTime() ? second : first;
}

function isRecruiteeOffer(value: unknown): value is RecruiteeOffer {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const offer = value as RecruiteeOffer;
  return Boolean(
    (offer.id || offer.guid)
      && offer.title
      && (offer.careers_url || offer.slug)
  );
}
