import type { MetadataRoute } from "next";

import { getCanonicalSeoJobs } from "@/lib/job-seo";
import { endpointToolOptions } from "@/lib/job-taxonomy";
import { isActiveJob } from "@/lib/jobs";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";

import {
  getApiDocsPath,
  getBoardPath,
  getMcpDocsPath,
  getRoadmapPath,
  getEndpointToolUrl,
  getJobUrl,
  getJobsDirectoryPath,
  jobsDirectoryPageSize,
  ogImage,
  siteUrl
} from "./site-metadata";

// Daily backstop. The refresh workflow revalidates this route after publishing the feed.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const feed = await getPublishedJobsFeed();

  const activeJobs = feed.jobs.filter((job) => isActiveJob(job));
  const jobPages = getCanonicalSeoJobs(activeJobs).map((job) => ({
    url: getJobUrl(job.id),
    changeFrequency: "daily" as const,
    priority: 0.8
  }));

  const directoryPages = Array.from(
    { length: Math.max(1, Math.ceil(jobPages.length / jobsDirectoryPageSize)) },
    (_, index) => ({
      url: new URL(getJobsDirectoryPath(index + 1), siteUrl).toString(),
      lastModified: new Date(feed.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.7
    })
  );

  return [
    {
      url: siteUrl,
      lastModified: new Date(feed.updatedAt),
      changeFrequency: "daily",
      priority: 1,
      images: [new URL(ogImage.url, siteUrl).toString()]
    },
    {
      url: new URL(getBoardPath(), siteUrl).toString(),
      lastModified: new Date(feed.updatedAt),
      changeFrequency: "daily",
      priority: 0.9
    },
    {
      url: new URL(getApiDocsPath(), siteUrl).toString(),
      lastModified: new Date(feed.updatedAt),
      changeFrequency: "weekly",
      priority: 0.6
    },
    {
      url: new URL(getMcpDocsPath(), siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 0.6
    },
    {
      url: new URL("/privacy", siteUrl).toString(),
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: new URL(getRoadmapPath(), siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.5
    },
    ...endpointToolOptions.map((tool) => ({
      url: getEndpointToolUrl(tool),
      lastModified: new Date(feed.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.9
    })),
    ...directoryPages,
    ...jobPages
  ];
}
