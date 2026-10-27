import type { Metadata } from "next";
import Link from "next/link";

import { initialFilterState } from "@/components/job-board/filter-model";
import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import { getActiveBoardFeed, queryBoardPage } from "@/lib/board-page";
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
  const activeFeed = getActiveBoardFeed(feedData as JobsFeed);
  const board = queryBoardPage(activeFeed, initialFilterState, 1);
  const preview = board.jobs.slice(0, 4).map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    workplace: getJobWorkplace(job)
  }));
  const stats = [
    { label: "Open roles", value: board.total },
    { label: "Remote or hybrid", value: board.metrics.remoteJobsCount },
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

          <aside className="landing-preview" aria-label="Newest open roles">
            <header>
              <p className="section-kicker">Newest on the board</p>
              <Link href={getBoardPath()}>All roles</Link>
            </header>
            {preview.length === 0 ? (
              <p className="landing-preview-empty">No open roles yet.</p>
            ) : (
              <ol>
                {preview.map((job) => (
                  <li key={job.id}>
                    <Link href={getJobPath(job.id)}>
                      <strong>{job.title}</strong>
                      <span>
                        <span>{job.company}</span>
                        <span className="landing-workplace">{job.workplace}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </section>

        <p className="landing-account">
          <strong id="landing-account-title">Why an account.</strong> An account is optional.
          Sign in with Google or GitHub to keep jobs you save, filters you choose to keep, and
          which listings you have opened. <Link href="/privacy">Privacy policy</Link>
        </p>

        <SiteFooter updatedAt={activeFeed.updatedAt} />
      </div>
      <script type="application/ld+json">
        {serializeJsonLd(getLandingJsonLd())}
      </script>
    </main>
  );
}
