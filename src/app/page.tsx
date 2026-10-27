import type { Metadata } from "next";
import Link from "next/link";

import { AuthMenu } from "@/components/auth/auth-menu";
import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";

import { getBoardPath, siteDescription } from "./site-metadata";
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

export default function Home() {
  const updatedAt = (feedData as JobsFeed).updatedAt;

  return (
    <main className="site-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={updatedAt} />
        <section className="landing" aria-labelledby="landing-title">
          <p className="section-kicker">Endpoint Jobs</p>
          <h1 id="landing-title">Endpoint engineering jobs, refreshed daily</h1>
          <p className="landing-lead">{siteDescription}</p>
          <div className="landing-actions">
            <Link className="landing-jobs-link" href={getBoardPath()}>
              See the jobs
            </Link>
            <AuthMenu variant="landing" />
          </div>
          <section className="landing-account" aria-labelledby="landing-account-title">
            <h2 id="landing-account-title">Why an account</h2>
            <p>
              Signing in with Google or GitHub creates your Endpoint Jobs account the first
              time. The account stores your email, jobs you save, filters you choose to keep,
              and which listings you have opened. That lets you return to the same search and
              tell which roles you already saw.
            </p>
            <p>
              An account is optional. The job board works signed out: filters stay in the page
              address, and no account data is stored. There are no ads, and this information
              is not sold. Endpoint Jobs never sees your Google or GitHub password.
            </p>
            <p>
              <Link href="/privacy">Privacy policy</Link>
            </p>
          </section>
        </section>
        <SiteFooter updatedAt={updatedAt} />
      </div>
      <script type="application/ld+json">
        {serializeJsonLd(getLandingJsonLd())}
      </script>
    </main>
  );
}
