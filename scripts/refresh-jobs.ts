import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ProviderAdapter } from "./job-refresh/provider";
import { atsBoardProviders } from "./job-refresh/providers/ats-boards";
import { companyAtsProviders } from "./job-refresh/providers/company-ats";
import { curatedJobProvider } from "./job-refresh/providers/curated-jobs";
import { publicJobBoardProviders } from "./job-refresh/providers/public-job-boards";
import { rapidApiDailyJobsProvider } from "./job-refresh/providers/rapidapi-daily-jobs";
import { rapidApiLinkedInProvider } from "./job-refresh/providers/rapidapi-linkedin";
import { serpApiProvider } from "./job-refresh/providers/serpapi";
import { techmapRssProvider } from "./job-refresh/providers/techmap-rss";
import { theirStackProvider } from "./job-refresh/providers/theirstack";
import { extractSalaryFromText, normalizeSearchText } from "./job-refresh/shared";

import type { Job, JobsFeed } from "../src/types/job";

const outputPath = resolve(process.env.JOB_OUTPUT_PATH ?? "src/data/jobs.json");

const maxJobs = Number(process.env.JOB_MAX_RESULTS ?? 80);

async function main() {
  const configuredProviders = getConfiguredProviders();
  const fetchedAt = new Date();
  const result = await fetchConfiguredProviderJobs(configuredProviders, fetchedAt);
  const normalizedJobs = limitFeedJobs(
    dedupeJobs(
      result.jobs
        .filter((job): job is Job => Boolean(job))
        .map(addExtractedSalary)
        .filter((job) => new Date(job.staleAfter).getTime() >= fetchedAt.getTime())
    ).sort(compareJobsByPostedAtDesc),
    maxJobs,
    new Set(result.reservedJobIds)
  );

  const feed: JobsFeed = {
    updatedAt: fetchedAt.toISOString(),
    source: getFeedSourceMetadata(result.providers),
    jobs: normalizedJobs
  };

  validateFeed(feed);

  if (normalizedJobs.length === 0 && process.env.JOB_ALLOW_EMPTY !== "true") {
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
  rapidApiLinkedInProvider
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

function addExtractedSalary(job: Job): Job {
  if (job.salary?.min || job.salary?.max) {
    return job;
  }

  const salary = extractSalaryFromText([job.summary, job.description].filter(Boolean).join(" "));
  return salary ? { ...job, salary } : job;
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
    .sort(compareJobsByPostedAtDesc)
    .slice(0, limit);
}

function compareJobsByPostedAtDesc(first: Job, second: Job) {
  return new Date(second.postedAt).getTime() - new Date(first.postedAt).getTime();
}

function dedupeJobs(jobs: Job[]) {
  const byKey = new Map<string, Job>();

  for (const job of jobs) {
    const sourceKey = normalizeSearchText(job.sourceUrl);
    const roleKey = normalizeSearchText([job.title, job.company, job.location].join("|"));
    const key = roleKey || sourceKey;
    const existing = byKey.get(key);

    if (!existing || new Date(job.postedAt).getTime() > new Date(existing.postedAt).getTime()) {
      byKey.set(key, job);
    }
  }

  return Array.from(byKey.values());
}

function validateFeed(feed: JobsFeed) {
  const seenIds = new Set<string>();

  for (const job of feed.jobs) {
    if (seenIds.has(job.id)) {
      throw new Error(`Duplicate job id in feed: ${job.id}`);
    }

    seenIds.add(job.id);
    assertPresent(job.source, job.id, "source");
    assertPresent(job.sourceUrl, job.id, "sourceUrl");
    assertPresent(job.applyUrl, job.id, "applyUrl");
    assertPresent(job.fetchedAt, job.id, "fetchedAt");
    assertPresent(job.postedAt, job.id, "postedAt");
    assertPresent(job.staleAfter, job.id, "staleAfter");
    assertPresent(job.attributionLabel, job.id, "attributionLabel");
    assertPresent(job.termsProfile, job.id, "termsProfile");
  }
}

function assertPresent(value: unknown, id: string, field: string) {
  if (!value) {
    throw new Error(`Job ${id} is missing ${field}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
