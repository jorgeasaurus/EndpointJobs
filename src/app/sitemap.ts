import type { MetadataRoute } from "next";

import feedData from "@/data/jobs.json";
import { getCanonicalSeoJobs } from "@/lib/job-seo";
import { endpointToolOptions } from "@/lib/job-taxonomy";
import { isActiveJob } from "@/lib/jobs";
import type { JobsFeed } from "@/types/job";

import {
  getApiDocsPath,
  getEndpointToolUrl,
  getJobUrl,
  getJobsDirectoryPath,
  jobsDirectoryPageSize,
  ogImage,
  siteUrl
} from "./site-metadata";

// Refresh directory pagination and job URLs as listings expire between feed builds.
export const revalidate = 300;

export default function sitemap(): MetadataRoute.Sitemap {
  const feed = feedData as JobsFeed;

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
      url: new URL(getApiDocsPath(), siteUrl).toString(),
      lastModified: new Date(feed.updatedAt),
      changeFrequency: "weekly",
      priority: 0.6
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
