import { existsSync } from "node:fs";

import {
  getHomeJsonLd,
  getJobJsonLd,
  serializeJsonLd
} from "../../src/app/structured-data";
import { getCanonicalSeoIndex, getCanonicalSeoJobs } from "../../src/lib/job-seo";
import type { Job } from "../../src/types/job";

import {
  assertEqual,
  assertIds,
  assertIncludes,
  assertNotIncludes,
  assertTruthy,
  makeJob,
  type AuditContext
} from "./shared";

export async function auditSeo({ feed, run, sources }: AuditContext) {
  await run("FEAT-051", "Metadata, Open Graph, and Twitter cards are configured", () => {
    ["metadataBase", "openGraph", "twitter", "siteKeywords", "creator", "publisher", "canonical"].forEach((text) =>
      assertIncludes(sources.layout, text)
    );
    assertIncludes(sources.siteMetadata, "Endpoint Engineering Jobs", "search-focused title");
    assertNotIncludes(sources.siteMetadata, "specialtySearchLinks", "removed specialty links");
    assertNotIncludes(
      sources.topbar,
      "Popular endpoint job searches",
      "removed footer search navigation"
    );
    assertIncludes(sources.jobCard, "id={`job-${job.id}`}", "stable job anchors");
    assertIncludes(sources.jobCard, "getJobPath(job.id)", "crawlable job detail links");
    assertIncludes(sources.jobPage, "generateMetadata", "unique job metadata");
    assertIncludes(sources.jobPage, "alternates: { canonical: url }", "job self-canonical");
    assertIncludes(sources.jobDirectory, "getJobsDirectoryPath(item)", "crawlable directory pages");
    assertIncludes(
      sources.jobDirectory,
      "page > Math.max(totalPages, 1)",
      "empty feed keeps page 1 valid"
    );
    assertIncludes(
      sources.jobPage,
      "key={hashParagraph(paragraph)}",
      "paragraph keys hash full content"
    );
    assertNotIncludes(sources.jobPage, "key={paragraph.slice(0, 64)}", "no prefix-collision keys");
    assertIncludes(sources.topbar, "getJobsDirectoryPath()", "directory discovery link");
    assertTruthy(existsSync("public/og-image.png"), "missing public/og-image.png");
  });

  await run("FEAT-052", "Home JSON-LD emits escaped collection data", () => {
    const jsonLd = getHomeJsonLd({
      ...feed,
      jobs: Array.from({ length: 25 }, (_, index) =>
        makeJob({
          id: `schema-${index}`,
          title: index === 0 ? "Endpoint <Engineer>" : `Endpoint Engineer ${index}`,
          company: "Schema Co",
          applyUrl: index === 0 ? undefined : `https://example.com/apply/${index}`,
          sourceUrl: `https://example.com/source/${index}`
        })
      )
    });
    const serialized = serializeJsonLd(jsonLd);
    assertEqual(jsonLd["@graph"].length, 5, "structured-data graph node count");
    assertIncludes(serialized, "CollectionPage");
    assertIncludes(serialized, "ItemList");
    assertIncludes(serialized, "SearchAction");
    assertIncludes(serialized, "WebApplication");
    assertIncludes(serialized, "BreadcrumbList");
    assertIncludes(serialized, '"numberOfItems":25');
    assertIncludes(serialized, "/jobs/schema-19");
    assertNotIncludes(serialized, "/jobs/schema-20", "structured listing cap");
    assertIncludes(serialized, "https://example.com/source/0", "source URL sameAs fallback");
    assertNotIncludes(serialized, "#popular-searches");
    assertIncludes(serialized, "\\u003cEngineer>");

    const detailedJob = makeJob({
      id: "seo-detail",
      title: "Endpoint <Engineer>",
      company: "Schema Co",
      location: "Austin, TX",
      workplace: "Hybrid",
      employmentType: "Full-time",
      description: `Endpoint <Engineer> role. ${"Own endpoint platforms and automation. ".repeat(35)}\nBuild secure workflows.`,
      applyUrl: "https://example.com/apply/seo-detail"
    });
    const jobSerialized = serializeJsonLd(getJobJsonLd(detailedJob));
    assertIncludes(jobSerialized, '"@type":"JobPosting"');
    assertIncludes(jobSerialized, '"employmentType":"FULL_TIME"');
    assertIncludes(jobSerialized, '"addressCountry":"US"');
    assertIncludes(jobSerialized, "Endpoint &lt;Engineer&gt;", "escaped job description");
    assertIncludes(jobSerialized, '"@type":"BreadcrumbList"');

    const snippetOnly = serializeJsonLd(getJobJsonLd(makeJob({ description: undefined })));
    assertNotIncludes(snippetOnly, '"@type":"JobPosting"', "snippet-only rich result");
    assertIncludes(snippetOnly, '"@type":"BreadcrumbList"');

    const unsupportedLocation = serializeJsonLd(
      getJobJsonLd(makeJob({
        description: "Complete role details. ".repeat(60),
        location: "Unspecified",
        mapLocation: undefined,
        workplace: "Unknown"
      }))
    );
    assertNotIncludes(
      unsupportedLocation,
      '"@type":"JobPosting"',
      "job without a supported structured location"
    );

    const remoteJob = serializeJsonLd(
      getJobJsonLd(makeJob({
        description: "Complete role details. ".repeat(60),
        location: "United States",
        workplace: "Remote"
      }))
    );
    assertNotIncludes(
      remoteJob,
      '"@type":"JobPosting"',
      "remote job without verified geographic eligibility"
    );

    const truncatedJob = serializeJsonLd(
      getJobJsonLd(makeJob({
        description: `${"Complete role details. ".repeat(60)}...`,
        location: "Austin, TX",
        workplace: "Hybrid"
      }))
    );
    assertNotIncludes(
      truncatedJob,
      '"@type":"JobPosting"',
      "truncated description rich result"
    );

    const partnerSnippet = serializeJsonLd(
      getJobJsonLd(makeJob({
        description: "Complete role details. ".repeat(60),
        location: "Austin, TX",
        termsProfile: "partner-terms",
        workplace: "Hybrid"
      }))
    );
    assertNotIncludes(
      partnerSnippet,
      '"@type":"JobPosting"',
      "non-provider description rich result"
    );

    const multipleLocations = serializeJsonLd(
      getJobJsonLd(makeJob({
        description: "Complete role details. ".repeat(60),
        location: "Austin, TX; New York, NY",
        workplace: "Hybrid"
      }))
    );
    assertNotIncludes(
      multipleLocations,
      '"@type":"JobPosting"',
      "collapsed multi-location rich result"
    );
  });

  await run("FEAT-053", "Sitemap and robots point at the canonical site", () => {
    assertIncludes(sources.sitemap, "feed.updatedAt");
    assertIncludes(sources.sitemap, "siteUrl");
    assertIncludes(sources.sitemap, "images");
    assertIncludes(sources.sitemap, "getJobUrl(job.id)", "job detail URLs");
    assertIncludes(sources.sitemap, "isActiveJob(job)", "active jobs only");
    assertIncludes(sources.sitemap, "getCanonicalSeoJobs(activeJobs)", "canonical jobs only");
    assertNotIncludes(sources.sitemap, "job.fetchedAt", "fetch time as false last-modified");
    assertIncludes(sources.robots, "sitemap");
    assertIncludes(sources.robots, "Googlebot");
    assertIncludes(sources.robots, "host: siteUrl");

    const fullDescription = "Direct provider role details. ".repeat(50);
    const canonicalJobs = getCanonicalSeoJobs([
      makeJob({
        id: "aggregated-copy",
        company: "Example Company",
        description: fullDescription,
        source: "The Muse"
      }),
      makeJob({
        id: "direct-copy",
        company: "example company",
        description: fullDescription,
        source: "Greenhouse"
      })
    ]);
    assertIds(canonicalJobs, ["direct-copy"]);

    // Direct jobs are always their own canonical, so every direct twin stays
    // crawlable; aggregated copies defer to the deterministic representative
    // (lexicographically smallest direct id), regardless of feed order.
    const assertAggregatedDefersTo = (jobs: Job[], expectedId: string) => {
      const index = getCanonicalSeoIndex(jobs);
      assertEqual(index.get("aggregated-copy"), expectedId, "aggregated canonical target");
    };

    assertAggregatedDefersTo(
      [
        makeJob({
          id: "direct-zeta",
          company: "example company",
          description: fullDescription,
          source: "Greenhouse"
        }),
        makeJob({
          id: "direct-alpha",
          company: "example company",
          description: fullDescription,
          source: "Lever"
        }),
        makeJob({
          id: "aggregated-copy",
          company: "Example Company",
          description: fullDescription,
          source: "The Muse"
        })
      ],
      "direct-alpha"
    );

    assertAggregatedDefersTo(
      [
        makeJob({
          id: "direct-alpha",
          company: "example company",
          description: fullDescription,
          source: "Lever"
        }),
        makeJob({
          id: "direct-zeta",
          company: "example company",
          description: fullDescription,
          source: "Greenhouse"
        }),
        makeJob({
          id: "aggregated-copy",
          company: "Example Company",
          description: fullDescription,
          source: "The Muse"
        })
      ],
      "direct-alpha"
    );
  });

  await run("FEAT-054", "Vercel Analytics is installed globally", () => {
    assertIncludes(sources.layout, "@vercel/analytics/next");
    assertIncludes(sources.layout, "<Analytics />");
    assertIncludes(sources.packageJson, "\"@vercel/analytics\"");
  });

  await run("FEAT-055", "React Doctor CI is configured for PRs and main", () => {
    assertIncludes(sources.reactDoctorWorkflow, "pull_request");
    assertIncludes(sources.reactDoctorWorkflow, "push");
    assertIncludes(sources.reactDoctorWorkflow, "branches: [\"main\"]");
    assertIncludes(sources.reactDoctorWorkflow, "millionco/react-doctor@v2");
    assertIncludes(sources.reactDoctorWorkflow, "cancel-in-progress: true");
  });

  await run("FEAT-056", "GitHub issue template captures support and feature reports", () => {
    ["Request type", "Summary", "Details", "Steps to reproduce", "Device and browser"].forEach(
      (text) => assertIncludes(sources.issueTemplate, text)
    );
    assertIncludes(sources.issueConfig, "blank_issues_enabled");
  });

  await run("FEAT-078", "Crawlable job detail pages prerender with canonical redirects and JSON-LD", () => {
    assertIncludes(sources.jobPage, "generateStaticParams", "static prerendering per job");
    assertIncludes(sources.jobPage, "permanentRedirect(getJobPath(canonicalJobId))", "duplicates redirect to canonical id");
    assertIncludes(sources.jobPage, "notFound()", "unknown ids 404");
    assertIncludes(sources.jobPage, "serializeJsonLd(getJobJsonLd(job))", "JobPosting JSON-LD");

    const job = makeJob({
      id: "seo-detail-job",
      title: "Intune Endpoint Engineer",
      company: "Detail Co",
      location: "London, UK",
      workplace: "Hybrid",
      description: `Manage Intune endpoint policy across the estate. ${"Deep endpoint operations detail. ".repeat(40)}`
    });
    const jsonLd = getJobJsonLd(job);
    assertEqual(jsonLd["@context"], "https://schema.org");
    const graph = jsonLd["@graph"] as Array<Record<string, unknown>>;
    const jobPosting = graph.find((node) => node["@type"] === "JobPosting");
    if (!jobPosting) throw new Error("JSON-LD @graph missing JobPosting node");
    assertTruthy(jobPosting.datePosted, "JobPosting missing datePosted");
    assertTruthy(jobPosting.hiringOrganization, "JobPosting missing hiringOrganization");
    assertTruthy(
      graph.some((node) => node["@type"] === "BreadcrumbList"),
      "JSON-LD @graph missing BreadcrumbList node"
    );
    assertIncludes(serializeJsonLd(jsonLd), "JobPosting", "serialized JSON-LD renders");

    const canonicalIndex = getCanonicalSeoIndex([job]);
    assertEqual(canonicalIndex.get(job.id), job.id, "unique job is its own canonical id");
  });
}
