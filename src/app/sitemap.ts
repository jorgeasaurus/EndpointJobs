import type { MetadataRoute } from "next";

import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";

import { siteUrl } from "./site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const feed = feedData as JobsFeed;

  return [
    {
      url: siteUrl,
      lastModified: new Date(feed.updatedAt),
      changeFrequency: "daily",
      priority: 1
    }
  ];
}
