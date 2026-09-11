import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import feedData from "@/data/jobs.json";
import { getCanonicalSeoIndex } from "@/lib/job-seo";
import {
  formatPostedDate,
  getExpandedDescriptionParagraphs,
  getFreshnessLabel,
  isActiveJob
} from "@/lib/jobs";
import { getJobWorkplace } from "@/lib/workplace";
import type { Job, JobsFeed } from "@/types/job";

import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { JobContextCards } from "@/components/job-board/job-context-cards";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import {
  getJobPath,
  getJobUrl,
  ogImage,
  siteDescription,
  siteName
} from "../../site-metadata";
import { getJobJsonLd, serializeJsonLd } from "../../structured-data";

type JobPageProps = {
  params: Promise<{ id: string }>;
};

const feed = feedData as JobsFeed;

function getActiveJobs(now = new Date()) {
  return feed.jobs.filter((job) => isActiveJob(job, now));
}

export function generateStaticParams() {
  const canonicalJobIndex = getCanonicalSeoIndex(getActiveJobs());
  return [...new Set(canonicalJobIndex.values())].map((id) => ({ id }));
}

type ResolvedJobPage =
  | { kind: "found"; job: Job; canonicalJobId: string }
  | { kind: "not-found" };

function resolveJobPageState(id: string): ResolvedJobPage {
  const activeJobs = getActiveJobs();
  const job = activeJobs.find((candidate) => candidate.id === id);
  if (!job) return { kind: "not-found" };

  const canonicalJobId = getCanonicalSeoIndex(activeJobs).get(job.id) ?? job.id;
  return { kind: "found", job, canonicalJobId };
}

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = resolveJobPageState(id);

  if (resolved.kind === "not-found") {
    return {
      title: "Job not found",
      description: siteDescription,
      robots: { index: false, follow: false }
    };
  }

  const { job, canonicalJobId } = resolved;
  const title = `${job.title} at ${job.company}`;
  const description = getMetaDescription(job);
  const url = getJobUrl(canonicalJobId);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName,
      title,
      description,
      images: [ogImage]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url]
    }
  };
}

export default async function JobPage({ params }: JobPageProps) {
  const { id } = await params;
  const resolved = resolveJobPageState(id);

  if (resolved.kind === "not-found") {
    notFound();
  }

  const { job, canonicalJobId } = resolved;

  if (canonicalJobId !== job.id) {
    permanentRedirect(getJobPath(canonicalJobId));
  }

  const applicationUrl = job.applyUrl ?? job.sourceUrl;
  const paragraphOccurrences = new Map<string, number>();
  const descriptionParagraphs = getExpandedDescriptionParagraphs(job).map((text) => {
    const occurrence = paragraphOccurrences.get(text) ?? 0;
    paragraphOccurrences.set(text, occurrence + 1);
    return { text, key: JSON.stringify([text, occurrence]) };
  });

  return (
    <main className="site-frame job-detail-frame">
      <ParallaxBackground />

      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />

        <nav aria-label="Breadcrumb" className="job-detail-breadcrumbs">
          <Link href="/#open-roles">All endpoint jobs</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{job.title}</span>
        </nav>

        <article className="job-detail">
          <header className="job-detail-header">
            <div className="job-detail-kicker">
              <span className="source-pill">{job.source}</span>
              <time dateTime={job.postedAt}>{getFreshnessLabel(job.postedAt)}</time>
            </div>

            <h1>{job.title}</h1>
            <p className="job-detail-company">{job.company}</p>
            <p className="job-detail-summary">{job.summary}</p>

            <div className="job-detail-actions">
              <a
                className="job-detail-apply"
                href={applicationUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Apply for this role
              </a>
              <Link className="job-detail-back" href="/#open-roles">
                Browse all roles
              </Link>
            </div>
          </header>

          <div
            className={
              descriptionParagraphs.length > 0
                ? "job-detail-layout"
                : "job-detail-layout job-detail-layout--summary-only"
            }
          >
            {descriptionParagraphs.length > 0 ? (
              <section aria-labelledby="job-description-heading" className="job-detail-description">
                <span className="section-kicker">Role overview</span>
                <h2 id="job-description-heading">Job description</h2>
                {descriptionParagraphs.map((paragraph) => (
                  <p key={paragraph.key}>{paragraph.text}</p>
                ))}
              </section>
            ) : null}

            <aside aria-label="Job details" className="job-detail-sidebar">
              <h2>Role details</h2>
              <dl>
                <div>
                  <dt>Location</dt>
                  <dd>{job.location}</dd>
                </div>
                <div>
                  <dt>Workplace</dt>
                  <dd>{getJobWorkplace(job)}</dd>
                </div>
                <div>
                  <dt>Employment</dt>
                  <dd>{job.employmentType}</dd>
                </div>
                <div>
                  <dt>Seniority</dt>
                  <dd>{job.seniority}</dd>
                </div>
                <div>
                  <dt>Posted</dt>
                  <dd>
                    <time dateTime={job.postedAt}>{formatPostedDate(job.postedAt)}</time>
                  </dd>
                </div>
                {job.salary ? (
                  <div>
                    <dt>Salary</dt>
                    <dd>{job.salary.label}</dd>
                  </div>
                ) : null}
              </dl>

              <JobContextCards job={job} />
            </aside>
          </div>
        </article>

        <SiteFooter updatedAt={feed.updatedAt} />
      </div>

      <script type="application/ld+json">
        {serializeJsonLd(getJobJsonLd(job))}
      </script>
    </main>
  );
}

function getMetaDescription(job: Job) {
  const description = `${job.title} at ${job.company} in ${job.location}. ${job.summary}`;

  if (description.length <= 155) {
    return description;
  }

  const shortened = description.slice(0, 152);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 100 ? lastSpace : 152).trimEnd()}...`;
}
