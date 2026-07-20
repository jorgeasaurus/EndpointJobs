import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import { getCanonicalSeoIndex } from "@/lib/job-seo";
import { formatPostedDate, isActiveJob } from "@/lib/jobs";
import type { JobsFeed } from "@/types/job";

import {
  getJobPath,
  getJobsDirectoryPath,
  siteDescription,
  siteUrl
} from "../site-metadata";

type DirectoryPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

const jobsPerPage = 50;
const feed = feedData as JobsFeed;

// The feed is static for the lifetime of the server, so the canonical index is
// computed once and reused on every request.
const canonicalJobIds = new Set(
  getCanonicalSeoIndex(feed.jobs.filter((job) => isActiveJob(job))).values()
);
const activeJobs = feed.jobs.filter(
  (job) => isActiveJob(job) && canonicalJobIds.has(job.id)
);

export async function generateMetadata({ searchParams }: DirectoryPageProps): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  const title = page > 1 ? `Endpoint Jobs Directory — Page ${page}` : "Endpoint Jobs Directory";
  const canonical = page > 1 ? `${siteUrl}/jobs?page=${page}` : `${siteUrl}/jobs`;

  return {
    title,
    description: siteDescription,
    alternates: { canonical },
    robots: { index: true, follow: true }
  };
}

export default async function JobsDirectory({ searchParams }: DirectoryPageProps) {
  const page = parsePage((await searchParams).page);
  const totalPages = Math.ceil(activeJobs.length / jobsPerPage);

  if (page > totalPages) {
    notFound();
  }

  const pageJobs = activeJobs.slice((page - 1) * jobsPerPage, page * jobsPerPage);

  return (
    <main className="site-frame job-detail-frame">
      <ParallaxBackground />

      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />

        <section className="job-directory">
          <header className="job-directory-header">
            <span className="section-kicker">Endpoint roles directory</span>
            <h1>All endpoint jobs</h1>
            <p>
              Browse {activeJobs.length} active endpoint engineering roles by title,
              company, and location.
            </p>
          </header>

          <ol className="job-directory-list" start={(page - 1) * jobsPerPage + 1}>
            {pageJobs.map((job) => (
              <li key={job.id}>
                <Link href={getJobPath(job.id)}>
                  <strong>{job.title}</strong>
                  <span>{job.company}</span>
                  <small>
                    {job.location} · <time dateTime={job.postedAt}>{formatPostedDate(job.postedAt)}</time>
                  </small>
                </Link>
              </li>
            ))}
          </ol>

          <nav aria-label="Job directory pages" className="job-directory-pagination">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
              <Link
                aria-current={item === page ? "page" : undefined}
                className={item === page ? "is-current" : undefined}
                href={getJobsDirectoryPath(item)}
                key={item}
              >
                <span className="sr-only">Page </span>{item}
              </Link>
            ))}
          </nav>
        </section>

        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}

function parsePage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const page = Number(candidate ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
}
