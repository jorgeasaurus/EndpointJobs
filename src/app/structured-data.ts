import type { JobsFeed } from "@/types/job";

import {
  repositoryUrl,
  siteDescription,
  siteKeywords,
  siteName,
  siteUrl
} from "./site-metadata";

export function getHomeJsonLd(feed: JobsFeed) {
  const topListings = feed.jobs.slice(0, 20).map((job, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `${siteUrl}/#job-${job.id}`,
    name: `${job.title} at ${job.company}`,
    item: {
      "@type": "Thing",
      name: `${job.title} at ${job.company}`,
      description: job.summary,
      url: `${siteUrl}/#job-${job.id}`,
      sameAs: job.applyUrl ?? job.sourceUrl
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
        keywords: siteKeywords.join(", "),
        publisher: {
          "@id": `${siteUrl}/#publisher`
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/?q={search_term_string}`,
          "query-input": "required name=search_term_string"
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
        keywords: siteKeywords.join(", "),
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
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#app`,
        name: siteName,
        url: siteUrl,
        description: siteDescription,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript for filtering and map interactions",
        isPartOf: {
          "@id": `${siteUrl}/#website`
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/#breadcrumbs`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: siteName,
            item: siteUrl
          }
        ]
      }
    ]
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
