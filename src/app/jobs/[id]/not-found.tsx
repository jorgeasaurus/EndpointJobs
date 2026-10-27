import type { Metadata } from "next";
import Link from "next/link";

import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";

import { getBoardPath } from "../../site-metadata";

const feed = feedData as JobsFeed;

export const metadata: Metadata = {
  title: "Job not found",
  description: "This listing is not on the Endpoint Jobs board.",
  robots: { index: false, follow: false }
};

export default function JobNotFound() {
  return (
    <main className="site-frame job-detail-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />
        <article className="job-detail">
          <header className="job-detail-header">
            <h1>Job not found</h1>
            <p className="job-detail-summary">This listing is not on the board.</p>
            <div className="job-detail-actions">
              <Link className="job-detail-back" href={getBoardPath()}>
                Browse all roles
              </Link>
            </div>
          </header>
        </article>
        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}
