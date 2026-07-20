import type { Job, JobsFeed } from "@/types/job";

import {
  formatDescriptionAsHtml
} from "@/lib/html";
import {
  inferAddressCountry,
  isRichResultEligible,
  normalizeEmploymentType
} from "@/lib/job-seo";
import {
  getJobUrl,
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
    url: getJobUrl(job.id),
    name: `${job.title} at ${job.company}`,
    item: {
      "@type": "Thing",
      name: `${job.title} at ${job.company}`,
      description: job.summary,
      url: getJobUrl(job.id),
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

export function getJobJsonLd(job: Job) {
  const jobUrl = getJobUrl(job.id);
  const addressCountry = inferAddressCountry(job);
  const jobPosting = addressCountry && isRichResultEligible(job)
    ? getJobPostingJsonLd(job, jobUrl, addressCountry)
    : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...(jobPosting ? [jobPosting] : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${jobUrl}#breadcrumbs`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: siteName,
            item: siteUrl
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `${job.title} at ${job.company}`,
            item: jobUrl
          }
        ]
      }
    ]
  };
}

function getJobPostingJsonLd(job: Job, jobUrl: string, addressCountry: string) {
  return {
    "@type": "JobPosting",
    "@id": `${jobUrl}#job-posting`,
    url: jobUrl,
    title: job.title,
    description: formatDescriptionAsHtml(job.description ?? job.summary),
    identifier: {
      "@type": "PropertyValue",
      name: job.company,
      value: job.id
    },
    datePosted: job.postedAt,
    ...(job.expiresAt ? { validThrough: job.expiresAt } : {}),
    employmentType: normalizeEmploymentType(job.employmentType),
    directApply: false,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location,
        addressCountry
      }
    }
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
