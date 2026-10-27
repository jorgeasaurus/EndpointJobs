import type { Metadata } from "next";
import Link from "next/link";

import { LandingSignIn } from "@/components/auth/landing-sign-in";
import { initialFilterState } from "@/components/job-board/filter-model";
import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import { getActiveSourceFeed, queryBoardPage, selectLandingPreview } from "@/lib/board-page";
import { formatRelativePosted, formatRelativeUpdated, formatUpdatedAt } from "@/lib/jobs";
import { formatRolePlace } from "@/lib/role-place";
import { formatShownSalary } from "@/lib/shown-salary";
import { getJobWorkplace } from "@/lib/workplace";
import type { JobsFeed } from "@/types/job";

import { getBoardPath, getJobPath } from "./site-metadata";
import { getLandingJsonLd, serializeJsonLd } from "./structured-data";
import "./landing.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  }
};

const countFormat = new Intl.NumberFormat("en-US");

export default function Home() {
  const activeFeed = getActiveSourceFeed(feedData as JobsFeed);
  const board = queryBoardPage(activeFeed, initialFilterState, 1);
  const preview = selectLandingPreview(activeFeed.jobs, initialFilterState).map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    place: formatRolePlace(job.location),
    workplace: getJobWorkplace(job),
    salary: formatShownSalary(job) ?? "",
    posted: formatRelativePosted(job),
    postedAt: job.postedAt,
    postedTitle: formatUpdatedAt(job.postedAt)
  }));
  const stats = [
    { label: "Open roles", value: board.total },
    { label: "Remote/hybrid", value: board.metrics.remoteJobsCount },
    { label: "Salary shown", value: board.metrics.salaryJobsCount }
  ];

  return (
    <main className="site-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={activeFeed.updatedAt} />

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <div className="landing-intro">
              <h1 id="landing-title">The board for endpoint engineers.</h1>
              <p className="landing-lead">
                Daily listings for macOS, Windows, MDM, and endpoint security roles.
              </p>
              <div className="landing-actions">
                <Link className="landing-jobs-link" href={getBoardPath()}>
                  See the jobs
                </Link>
              </div>
            </div>
            <dl className="landing-stats">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{countFormat.format(stat.value)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className="landing-preview" aria-label="Newest roles with salary">
            <header>
              <div className="landing-preview-heading">
                <p className="section-kicker">Newest with salary</p>
                <time
                  className="landing-updated"
                  dateTime={activeFeed.updatedAt}
                  title={formatUpdatedAt(activeFeed.updatedAt)}
                >
                  {formatRelativeUpdated(activeFeed.updatedAt)}
                </time>
              </div>
              <Link href={getBoardPath()}>All roles</Link>
            </header>
            {preview.length === 0 ? (
              <p className="landing-preview-empty">No roles with a posted salary yet.</p>
            ) : (
              <ol>
                {preview.map((job) => (
                  <li key={job.id}>
                    <Link href={getJobPath(job.id)}>
                      <strong>{job.title}</strong>
                      <span className="landing-company">
                        {job.company}
                        {job.place ? <span className="landing-place"> · {job.place}</span> : null}
                      </span>
                      <span className="landing-role-facts">
                        <span className="landing-salary">{job.salary}</span>
                        <span className="landing-role-tags">
                          {job.posted ? (
                            <time className="landing-posted" dateTime={job.postedAt} title={job.postedTitle}>
                              {job.posted}
                            </time>
                          ) : null}
                          <span className="landing-workplace">{job.workplace}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </section>

        <LandingSignIn>
          Sign in to save jobs, filters, and viewed job history
        </LandingSignIn>

        <SiteFooter updatedAt={activeFeed.updatedAt} />
      </div>
      <script type="application/ld+json">
        {serializeJsonLd(getLandingJsonLd())}
      </script>
    </main>
  );
}
