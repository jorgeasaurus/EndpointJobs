import type { JobsFeed } from "@/types/job";

import { repositoryUrl, siteDescription, siteName, siteUrl } from "./site-metadata";

export function getHomeJsonLd(feed: JobsFeed) {
  const topListings = feed.jobs.slice(0, 10).map((job, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: job.applyUrl ?? job.sourceUrl,
    name: `${job.title} at ${job.company}`,
    item: {
      "@type": "Thing",
      name: `${job.title} at ${job.company}`,
      description: job.summary,
      url: job.applyUrl ?? job.sourceUrl
    }
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteName,
        url: siteUrl,
        description: siteDescription,
        inLanguage: "en-US",
        publisher: {
          "@id": `${siteUrl}/#publisher`
        }
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#publisher`,
        name: siteName,
        url: siteUrl,
        sameAs: [repositoryUrl]
      },
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/#endpoint-jobs`,
        name: "Endpoint Engineering job listings",
        url: siteUrl,
        description: siteDescription,
        inLanguage: "en-US",
        dateModified: feed.updatedAt,
        isPartOf: {
          "@id": `${siteUrl}/#website`
        },
        about: [
          "Endpoint Engineering",
          "macOS",
          "Windows",
          "Mobile Device Management",
          "Unified Endpoint Management",
          "Client Platform Engineering"
        ],
        mainEntity: {
          "@type": "ItemList",
          name: "Current endpoint engineering opportunities",
          numberOfItems: feed.jobs.length,
          itemListElement: topListings
        }
      }
    ]
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
