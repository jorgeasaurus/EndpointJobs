import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { LandingSignIn } from "@/components/auth/landing-sign-in";
import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter } from "@/components/job-board/site-footer";
import { Topbar } from "@/components/job-board/topbar";
import { getActiveSourceFeed } from "@/lib/board-page";
import { getEndpointToolLabel } from "@/lib/job-taxonomy";
import { formatRelativePosted, formatRelativeUpdated, formatUpdatedAt } from "@/lib/jobs";
import { selectLanding } from "@/lib/landing";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";
import { formatRolePlace } from "@/lib/role-place";
import { formatShownSalary } from "@/lib/shown-salary";
import { getJobWorkplace } from "@/lib/workplace";

import { getBoardPath, getEndpointToolPath, getJobPath } from "./site-metadata";
import { getLandingJsonLd, serializeJsonLd } from "./structured-data";
import "./landing.css";

// Daily backstop. The refresh workflow revalidates this route after publishing the feed.
export const revalidate = 86400;

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

// Tags a preview card can hold before its tool line wraps.
const previewToolTags = 3;

export default async function Home() {
  const activeFeed = getActiveSourceFeed(await getPublishedJobsFeed());
  const { total, preview: previewRoles, toolCounts } = selectLanding(activeFeed.jobs);
  const preview = previewRoles.map(({ job, managementTools }) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    place: formatRolePlace(job.location),
    tools: managementTools.slice(0, previewToolTags).map(getEndpointToolLabel),
    workplace: getJobWorkplace(job),
    salary: formatShownSalary(job) ?? "",
    posted: formatRelativePosted(job),
    postedAt: job.postedAt,
    postedTitle: formatUpdatedAt(job.postedAt)
  }));

  return (
    <main className="site-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar />

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <div className="landing-intro">
              <h1 id="landing-title">The board for endpoint engineers.</h1>
              <p className="landing-lead">
                Endpoint roles only, gathered daily from company career pages and job boards.
                Salary shown whenever the posting lists it.
              </p>
              <div className="landing-actions">
                <Link className="landing-jobs-link" href={getBoardPath()}>
                  See all {countFormat.format(total)} jobs
                  <ArrowRight aria-hidden="true" size={18} strokeWidth={2.25} />
                </Link>
              </div>
            </div>
            {toolCounts.length > 0 ? (
              <div className="landing-tools-block">
                <p className="landing-tools-caption" id="landing-tools-caption">Open roles by tool</p>
                <ul className="landing-tools" aria-labelledby="landing-tools-caption">
                  {toolCounts.map(({ tool, count }) => {
                    const label = getEndpointToolLabel(tool);
                    const formatted = countFormat.format(count);

                    return (
                      <li key={tool}>
                        <Link
                          aria-label={`${formatted} ${label} open ${count === 1 ? "role" : "roles"}`}
                          href={getEndpointToolPath(tool)}
                        >
                          <span className="landing-tool-count">{formatted}</span>
                          <span className="landing-tool-name">
                            {label}
                            <ArrowRight aria-hidden="true" size={14} strokeWidth={2.25} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <aside className="landing-preview" aria-label="Newest roles with salary">
            <header>
              <div className="landing-preview-heading">
                <h2 className="section-kicker">Newest with salary</h2>
                <time
                  className="landing-updated"
                  dateTime={activeFeed.updatedAt}
                  title={formatUpdatedAt(activeFeed.updatedAt)}
                >
                  {formatRelativeUpdated(activeFeed.updatedAt)}
                </time>
              </div>
              <Link href={getBoardPath()}>Job board</Link>
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
                      {job.tools.length > 0 ? (
                        <span className="landing-matched-tools">{job.tools.join(" · ")}</span>
                      ) : null}
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

        <LandingSignIn />

        <SiteFooter updatedAt={activeFeed.updatedAt} />
      </div>
      <script type="application/ld+json">
        {serializeJsonLd(getLandingJsonLd())}
      </script>
    </main>
  );
}
