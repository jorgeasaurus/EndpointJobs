import { XMLParser } from "fast-xml-parser";

import type { Job } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import {
  addDays,
  buildStableJobId,
  cleanText,
  cleanUrl,
  deriveMatchReasons,
  derivePlatforms,
  deriveTools,
  inferEmploymentType,
  inferRoleFamily,
  inferSeniority,
  inferWorkplace,
  isEndpointRelevant,
  normalizeDescription,
  normalizeSearchText,
  normalizeTags,
  parseDateLike,
  stripHtml,
  summarize,
  toArray
} from "../shared";

type SchoolJobsItem = {
  title?: unknown;
  link?: unknown;
  guid?: unknown;
  description?: unknown;
  pubDate?: unknown;
  "joblisting:jobId"?: unknown;
  "joblisting:advertiseFromDateUTC"?: unknown;
  "joblisting:advertiseToDateTimeUTC"?: unknown;
  "joblisting:jobType"?: unknown;
  "joblisting:department"?: unknown;
  "joblisting:division"?: unknown;
  "joblisting:examplesofduties"?: unknown;
  "joblisting:qualifications"?: unknown;
  "joblisting:supplementalinformation"?: unknown;
  "joblisting:location"?: unknown;
  "joblisting:categories"?: unknown;
};

type SchoolJobsChannel = {
  title?: unknown;
  item?: unknown;
};

const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);

export const schoolJobsProvider = {
  id: "schooljobs",
  displayName: "SchoolJobs",
  defaultUrl: "https://www.schooljobs.com/SearchEngine/JobsFeed?agency=tacomapublicschools",
  fetchJobs: ({ url, fetchedAt }) => fetchSchoolJobs(url, fetchedAt)
} as const satisfies ProviderAdapter<"schooljobs">;

async function fetchSchoolJobs(url: string, fetchedAt: Date) {
  const response = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/jorgeasaurus/EndpointJobs)"
    }
  });

  if (!response.ok) {
    throw new Error(`SchoolJobs request failed: ${response.status} ${response.statusText}`);
  }

  const parser = new XMLParser({
    attributeNamePrefix: "@_",
    ignoreAttributes: false,
    trimValues: true
  });
  const parsed = parser.parse(await response.text()) as unknown;
  const channel = getChannel(parsed);

  if (!channel) {
    throw new Error("SchoolJobs response did not contain an RSS channel");
  }

  const company = normalizeAgencyName(getXmlText(channel.title)) || "Tacoma Public Schools";
  return toArray(channel.item)
    .filter((item): item is SchoolJobsItem => Boolean(item && typeof item === "object"))
    .map((item) => normalizeSchoolJobsItem(item, company, fetchedAt));
}

function normalizeSchoolJobsItem(raw: SchoolJobsItem, company: string, fetchedAt: Date): Job | null {
  const title = cleanText(getXmlText(raw.title));
  const sourceUrl = cleanUrl(getXmlText(raw.link) ?? getXmlText(raw.guid));

  if (!title || !sourceUrl) {
    return null;
  }

  const rawDescription = stripHtml([
    raw.description,
    raw["joblisting:examplesofduties"],
    raw["joblisting:qualifications"],
    raw["joblisting:supplementalinformation"]
  ].map((value) => getXmlText(value) ?? "").filter(Boolean).join("\n\n"));
  const description = normalizeDescription(rawDescription);
  const searchableDescription = description ?? cleanText(rawDescription);
  const location = cleanText(getXmlText(raw["joblisting:location"]));
  const jobType = cleanText(getXmlText(raw["joblisting:jobType"]));
  const department = cleanText(getXmlText(raw["joblisting:department"]));
  const division = cleanText(getXmlText(raw["joblisting:division"]));
  const categories = getCategories(raw["joblisting:categories"]);
  const sourceTags = [department, division, jobType, ...categories].filter(Boolean);
  const haystack = normalizeSearchText([
    title,
    company,
    location,
    sourceTags.join(" "),
    searchableDescription
  ].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const postedAt = parseSchoolJobsUtcDate(getXmlText(raw["joblisting:advertiseFromDateUTC"]))
    ?? parseDateLike(getXmlText(raw.pubDate))
    ?? fetchedAt.toISOString();
  const closingAt = parseSchoolJobsUtcDate(getXmlText(raw["joblisting:advertiseToDateTimeUTC"]));
  const staleAfter = closingAt ?? addDays(new Date(postedAt), staleDays).toISOString();
  const nativeId = cleanText(getXmlText(raw["joblisting:jobId"]));

  return {
    id: buildStableJobId("schooljobs", company, title, nativeId ?? sourceUrl),
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    ...(closingAt ? { expiresAt: closingAt } : {}),
    source: "SchoolJobs",
    sourceUrl,
    applyUrl: sourceUrl,
    attributionLabel: `SchoolJobs / ${company}`,
    termsProfile: "public-api",
    summary: summarize(searchableDescription),
    ...(description ? { description } : {}),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons: deriveMatchReasons(haystack, tools, platforms),
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack, title),
    employmentType: jobType || inferEmploymentType(haystack)
  };
}

function getChannel(parsed: unknown): SchoolJobsChannel | undefined {
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }

  const channel = (parsed as { rss?: { channel?: unknown } }).rss?.channel;
  return channel && typeof channel === "object" ? channel as SchoolJobsChannel : undefined;
}

function normalizeAgencyName(value: string | undefined) {
  return cleanText(value).replace(/\s*\([A-Z]{2}\),\s*[A-Z]{2}$/i, "");
}

function parseSchoolJobsUtcDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return parseDateLike(value.replace(/:0$/, " GMT"));
}

function getCategories(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const category = (value as Record<string, unknown>)["joblisting:category"];
  return toArray(category).flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const label = cleanText(getXmlText((entry as Record<string, unknown>).Category));
    return label ? [label] : [];
  });
}

function getXmlText(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getXmlText).filter(Boolean).join("; ") || undefined;
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return getXmlText(candidate["#text"]) ?? getXmlText(candidate["#cdata"]);
  }

  return undefined;
}
