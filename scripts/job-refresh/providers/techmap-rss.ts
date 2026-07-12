import { XMLParser } from "fast-xml-parser";

import type { Job } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import {
  addDays,
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
  normalizeIdPart,
  normalizeSearchText,
  normalizeDescription,
  normalizeTags,
  stripHtml,
  summarize,
  toArray
} from "../shared";

type TechmapRssItem = {
  title?: unknown;
  link?: unknown;
  guid?: unknown;
  id?: unknown;
  pubDate?: unknown;
  published?: unknown;
  updated?: unknown;
  description?: unknown;
  summary?: unknown;
  content?: unknown;
  "content:encoded"?: unknown;
  category?: unknown;
  author?: unknown;
  "dc:creator"?: unknown;
  source?: unknown;
  company?: unknown;
  location?: unknown;
};

type TechmapRssFeed = {
  name: string;
  url: string;
};

const staleDays = Number(process.env.JOB_STALE_DAYS ?? 45);

export const techmapRssProvider = {
  id: "techmaprss",
  displayName: "Techmap RSS",
  defaultUrl: getFirstTechmapRssFeedUrl() || "https://techmap.example/rss",
  fetchJobs: ({ url, fetchedAt }) => fetchTechmapRssJobs(url, fetchedAt)
} as const satisfies ProviderAdapter;

async function fetchTechmapRssJobs(url: string, fetchedAt: Date) {
  const feeds = getTechmapRssFeeds(url);
  const jobs: Array<Job | null> = [];
  let successfulFeeds = 0;

  for (const feed of feeds) {
    try {
      const payload = await fetchTechmapRssFeed(feed);
      successfulFeeds += 1;
      jobs.push(...payload.map((job) => normalizeTechmapRssJob(job, feed, fetchedAt)));
      console.log(`Fetched ${payload.length} raw jobs from Techmap RSS/${feed.name}`);
    } catch (error) {
      console.warn(
        `Skipping Techmap RSS/${feed.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (successfulFeeds === 0) {
    throw new Error("No Techmap RSS feeds returned jobs");
  }

  return jobs;
}

async function fetchTechmapRssFeed(feed: TechmapRssFeed) {
  const authHeader = process.env.JOB_TECHMAP_RSS_AUTH_HEADER
    ?? (process.env.TECHMAP_RSS_TOKEN ? `Bearer ${process.env.TECHMAP_RSS_TOKEN}` : undefined);
  const response = await fetch(feed.url, {
    headers: {
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "user-agent": "EndpointJobs/1.0 (+https://github.com/)",
      ...(authHeader ? { authorization: authHeader } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`Techmap RSS ${feed.name} request failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    attributeNamePrefix: "@_",
    ignoreAttributes: false,
    trimValues: true
  });
  const parsed = parser.parse(xml) as unknown;
  return getRssItems(parsed);
}

function normalizeTechmapRssJob(raw: TechmapRssItem, feed: TechmapRssFeed, fetchedAt: Date): Job | null {
  const title = cleanText(getXmlText(raw.title));
  const sourceJobUrl = cleanUrl(getXmlText(raw.link)) ?? cleanUrl(getXmlText(raw.guid));
  const company = cleanText(
    getXmlText(raw.company)
      ?? getXmlText(raw.author)
      ?? getXmlText(raw["dc:creator"])
      ?? getXmlText(raw.source)
      ?? feed.name
  );

  if (!title || !company || !sourceJobUrl) {
    return null;
  }

  const description = stripHtml(
    [raw.description, raw.summary, raw.content, raw["content:encoded"]]
      .map((value) => getXmlText(value) ?? "")
      .join(" ")
  );
  const categories = flattenXmlValues(raw.category).map(cleanText).filter(Boolean);
  const location = cleanText(getXmlText(raw.location));
  const sourceTags = [feed.name, ...categories].filter(Boolean);
  const haystack = normalizeSearchText([title, company, location, sourceTags.join(" "), description].join(" "));
  const tools = deriveTools(haystack);
  const platforms = derivePlatforms(haystack);
  const matchReasons = deriveMatchReasons(haystack, tools, platforms);

  if (!isEndpointRelevant(haystack, title, tools)) {
    return null;
  }

  const rawDate = getXmlText(raw.pubDate) ?? getXmlText(raw.published) ?? getXmlText(raw.updated);
  const postedAt = rawDate && !Number.isNaN(new Date(rawDate).getTime())
    ? new Date(rawDate).toISOString()
    : fetchedAt.toISOString();
  const staleAfter = addDays(new Date(postedAt), staleDays).toISOString();
  const idSource = cleanText(getXmlText(raw.guid) ?? getXmlText(raw.id) ?? sourceJobUrl ?? title);

  return {
    id: `techmaprss-${normalizeIdPart(feed.name)}-${normalizeIdPart(idSource)}`,
    title,
    company,
    location: location || "Unknown",
    workplace: inferWorkplace(location, haystack),
    postedAt,
    fetchedAt: fetchedAt.toISOString(),
    staleAfter,
    expiresAt: staleAfter,
    source: "Techmap RSS",
    sourceUrl: sourceJobUrl,
    applyUrl: sourceJobUrl,
    attributionLabel: `Techmap RSS / ${feed.name}`,
    termsProfile: "partner-terms",
    summary: summarize(description),
    description: normalizeDescription(description),
    tags: normalizeTags(sourceTags, tools, platforms),
    matchReasons,
    tools,
    platforms,
    roleFamily: inferRoleFamily(haystack, tools, platforms),
    seniority: inferSeniority(haystack, title),
    employmentType: inferEmploymentType(haystack)
  };
}

function getRssItems(parsed: unknown): TechmapRssItem[] {
  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const root = parsed as {
    rss?: { channel?: { item?: unknown } };
    feed?: { entry?: unknown };
    channel?: { item?: unknown };
  };
  const items = root.rss?.channel?.item ?? root.feed?.entry ?? root.channel?.item;

  return toArray(items).filter((item): item is TechmapRssItem => Boolean(item && typeof item === "object"));
}

function getTechmapRssFeeds(defaultUrl: string) {
  const configured = process.env.JOB_TECHMAP_RSS_FEEDS;
  const values = configured
    ? configured.split(",")
    : defaultUrl && !defaultUrl.includes("techmap.example")
      ? [defaultUrl]
      : [];

  if (values.length === 0) {
    throw new Error("JOB_TECHMAP_RSS_FEEDS is required for the Techmap RSS provider");
  }

  return values
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => parseNamedUrlEntry(entry, `Techmap ${index + 1}`, "JOB_TECHMAP_RSS_FEEDS"));
}

function getFirstTechmapRssFeedUrl() {
  return process.env.JOB_TECHMAP_RSS_FEEDS
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => parseNamedUrlEntry(entry, `Techmap ${index + 1}`, "JOB_TECHMAP_RSS_FEEDS").url)
    .find(Boolean);
}

function parseNamedUrlEntry(entry: string, fallbackName: string, envKey: string): TechmapRssFeed {
  const separatorIndex = entry.indexOf("|");
  const name = separatorIndex === -1 ? fallbackName : cleanText(entry.slice(0, separatorIndex));
  const url = cleanUrl(separatorIndex === -1 ? entry : entry.slice(separatorIndex + 1));

  if (!entry || !name || !url) {
    throw new Error(`Invalid ${envKey} entry: ${entry}`);
  }

  return { name, url };
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
    return getXmlText(candidate["#text"])
      ?? getXmlText(candidate["#cdata"])
      ?? getXmlText(candidate.href)
      ?? getXmlText(candidate["@_href"])
      ?? getXmlText(candidate.url)
      ?? getXmlText(candidate["@_url"]);
  }

  return undefined;
}

function flattenXmlValues(value: unknown): string[] {
  return toArray(value).flatMap((entry) => {
    const text = getXmlText(entry);
    return text ? [text] : [];
  });
}
