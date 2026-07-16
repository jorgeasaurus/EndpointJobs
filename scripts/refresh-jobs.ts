import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ProviderAdapter } from "./job-refresh/provider";
import { aiDevBoardProvider } from "./job-refresh/providers/aidevboard";
import { atsBoardProviders } from "./job-refresh/providers/ats-boards";
import { companyAtsProviders } from "./job-refresh/providers/company-ats";
import { curatedJobProvider } from "./job-refresh/providers/curated-jobs";
import { publicJobBoardProviders } from "./job-refresh/providers/public-job-boards";
import { rapidApiDailyJobsProvider } from "./job-refresh/providers/rapidapi-daily-jobs";
import { rapidApiLinkedInProvider } from "./job-refresh/providers/rapidapi-linkedin";
import { recruiteeProvider } from "./job-refresh/providers/recruitee";
import { schoolJobsProvider } from "./job-refresh/providers/schooljobs";
import { serpApiProvider } from "./job-refresh/providers/serpapi";
import { smartRecruitersProvider } from "./job-refresh/providers/smartrecruiters";
import { techmapRssProvider } from "./job-refresh/providers/techmap-rss";
import { theirStackProvider } from "./job-refresh/providers/theirstack";
import { usaJobsProvider } from "./job-refresh/providers/usajobs";
import { resolveJobMapLocation } from "./job-refresh/map-location";
import { shouldWriteFeed, validateFeed } from "./job-refresh/feed-safety";
import {
  compareFeedSelectionPriority,
  selectFeedJobs
} from "./job-refresh/job-selection";
import { extractSalaryFromText } from "./job-refresh/shared";

import {
  isExcludedJobSourceUrl,
  isSourceFreshnessExpired,
  normalizeJobSourceUrl
} from "../src/lib/job-exclusions";
import type { Job, JobsFeed } from "../src/types/job";

const outputPath = resolve(process.env.JOB_OUTPUT_PATH ?? "src/data/jobs.json");

const defaultMaxJobs = 1000;
const maxJobs = getPositiveIntegerConfig(process.env.JOB_MAX_RESULTS, defaultMaxJobs);

async function main() {
  const configuredProviders = getConfiguredProviders();
  const fetchedAt = new Date();
  const excludedSourceUrls = getConfiguredExcludedSourceUrls();
  const result = await fetchConfiguredProviderJobs(configuredProviders, fetchedAt);
  const reservedJobIds = new Set(result.reservedJobIds);
  const normalizedJobs = limitFeedJobs(
    selectFeedJobs(
      result.jobs
        .filter((job): job is Job => Boolean(job))
        .map(addExtractedSalary)
        .map(addResolvedMapLocation)
        .filter((job) => !isExcludedJobSourceUrl(job.sourceUrl, excludedSourceUrls))
        .filter((job) => !isSourceFreshnessExpired(job, fetchedAt))
        .filter((job) => new Date(job.staleAfter).getTime() >= fetchedAt.getTime()),
      reservedJobIds
    ),
    maxJobs,
    reservedJobIds
  );

  const feed: JobsFeed = {
    updatedAt: fetchedAt.toISOString(),
    source: getFeedSourceMetadata(result.providers),
    jobs: normalizedJobs
  };

  validateFeed(feed, excludedSourceUrls);

  if (!shouldWriteFeed(normalizedJobs.length, process.env.JOB_ALLOW_EMPTY === "true")) {
    console.log(
      "No endpoint jobs matched the configured provider feeds; leaving src/data/jobs.json unchanged."
    );
    return;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${normalizedJobs.length} endpoint jobs from ${result.providers.length} provider(s) to ${outputPath}`
  );
}

const providerAdapters = [
  ...publicJobBoardProviders,
  ...atsBoardProviders,
  ...companyAtsProviders,
  curatedJobProvider,
  techmapRssProvider,
  theirStackProvider,
  serpApiProvider,
  rapidApiDailyJobsProvider,
  rapidApiLinkedInProvider,
  schoolJobsProvider,
  smartRecruitersProvider,
  recruiteeProvider,
  usaJobsProvider,
  aiDevBoardProvider
] as const satisfies readonly ProviderAdapter[];
type SupportedProvider = (typeof providerAdapters)[number]["id"];

const defaultProviders: SupportedProvider[] = [
  "remotive",
  "arbeitnow",
  "jobicy",
  "remoteok",
  "greenhouse",
  "lever",
  "muse",
  "ashby",
  "amazon",
  "workday",
  "jibe",
  "activate",
  "smartrecruiters",
  "recruitee",
  "schooljobs",
  "curated"
];

function getProviderAdapter(provider: SupportedProvider): ProviderAdapter {
  const adapter = providerAdapters.find((candidate) => candidate.id === provider);

  if (!adapter) {
    throw new Error(`Unsupported job provider: ${provider}`);
  }

  return adapter;
}

function isSupportedProvider(value: string): value is SupportedProvider {
  return providerAdapters.some((adapter) => adapter.id === value);
}

function getConfiguredProviders() {
  const configured = process.env.JOB_PROVIDERS ?? process.env.JOB_PROVIDER;
  const providerNames = configured
    ? configured.split(",")
    : defaultProviders;
  const providers = providerNames.map(normalizeProviderName);

  if (providers.length === 0) {
    throw new Error("No job providers configured");
  }

  return Array.from(new Set(providers));
}

function normalizeProviderName(value: string): SupportedProvider {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]/g, "");
  const provider = normalized === "remoteok" ? "remoteok" : normalized;

  if (!isSupportedProvider(provider)) {
    throw new Error(`Unsupported JOB_PROVIDERS entry: ${value}`);
  }

  return provider;
}

async function fetchConfiguredProviderJobs(
  providers: SupportedProvider[],
  fetchedAt: Date
): Promise<{
  jobs: Array<Job | null>;
  providers: SupportedProvider[];
  reservedJobIds: string[];
}> {
  const jobs: Array<Job | null> = [];
  const successfulProviders: SupportedProvider[] = [];
  const reservedJobIds: string[] = [];

  for (const provider of providers) {
    const adapter = getProviderAdapter(provider);
    const sourceUrl = getConfiguredSourceUrl(provider, providers.length === 1);

    try {
      const providerJobs = await adapter.fetchJobs({ url: sourceUrl, fetchedAt });
      successfulProviders.push(provider);
      jobs.push(...providerJobs);

      if (adapter.reserveFeedSlots) {
        reservedJobIds.push(...providerJobs.flatMap((job) => job?.id ? [job.id] : []));
      }

      console.log(`Fetched ${providerJobs.length} raw jobs from ${adapter.displayName}`);
    } catch (error) {
      console.warn(`Skipping ${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (successfulProviders.length === 0) {
    throw new Error("All configured job providers failed");
  }

  return { jobs, providers: successfulProviders, reservedJobIds };
}

function getConfiguredSourceUrl(provider: SupportedProvider, allowLegacyUrl: boolean) {
  if (provider === "techmaprss" && process.env.JOB_TECHMAP_RSS_API_URL) {
    return process.env.JOB_TECHMAP_RSS_API_URL;
  }

  const overrideKey = `JOB_${provider.toUpperCase()}_API_URL`;
  const providerOverride = process.env[overrideKey];

  if (providerOverride) {
    return providerOverride;
  }

  if (allowLegacyUrl && provider !== "workday" && process.env.JOB_API_URL) {
    return process.env.JOB_API_URL;
  }

  return getProviderAdapter(provider).defaultUrl;
}

function getFeedSourceMetadata(providers: SupportedProvider[]) {
  if (providers.length === 1) {
    const provider = providers[0];
    const adapter = getProviderAdapter(provider);

    return {
      name: adapter.displayName,
      url: getConfiguredSourceUrl(provider, true)
    };
  }

  return {
    name: providers.map((provider) => getProviderAdapter(provider).displayName).join(" + "),
    url: process.env.JOB_FEED_SOURCE_URL ?? "https://github.com/jorgeasaurus/EndpointJobs"
  };
}

function getPositiveIntegerConfig(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return fallback;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfiguredExcludedSourceUrls() {
  return (process.env.JOB_EXCLUDED_SOURCE_URLS ?? "")
    .split(",")
    .map(normalizeJobSourceUrl)
    .filter((value): value is string => Boolean(value));
}

function addExtractedSalary(job: Job): Job {
  if (job.salary?.min || job.salary?.max) {
    return job;
  }

  const salary = extractSalaryFromText([job.summary, job.description].filter(Boolean).join(" "));
  return salary ? { ...job, salary } : job;
}

function addResolvedMapLocation(job: Job): Job {
  if (job.mapLocation) {
    return job;
  }

  const mapLocation = resolveJobMapLocation(job.location);
  return mapLocation ? { ...job, mapLocation } : job;
}

function limitFeedJobs(jobs: Job[], limit: number, reservedJobIds: Set<string>) {
  if (jobs.length <= limit) {
    return jobs;
  }

  const reservedJobs = jobs.filter((job) => reservedJobIds.has(job.id));
  const regularLimit = Math.max(0, limit - reservedJobs.length);
  const regularJobs = jobs
    .filter((job) => !reservedJobIds.has(job.id))
    .slice(0, regularLimit);

  return [...regularJobs, ...reservedJobs]
    .sort(compareFeedSelectionPriority)
    .slice(0, limit);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
