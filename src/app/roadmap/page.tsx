import type { Metadata } from "next";

import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import { RoadmapExperience } from "@/components/roadmap/roadmap-board";
import { roadmapPageDescription, roadmapPageTitle } from "@/data/roadmap";
import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";
import { ogImage, siteName, siteUrl } from "@/app/site-metadata";

import "./roadmap.css";

const feed = feedData as JobsFeed;
const canonical = "/roadmap";
const socialTitle = `${roadmapPageTitle} | ${siteName}`;

export const metadata: Metadata = {
  title: roadmapPageTitle,
  description: roadmapPageDescription,
  alternates: { canonical },
  openGraph: {
    type: "website",
    url: new URL(canonical, siteUrl).toString(),
    siteName,
    title: socialTitle,
    description: roadmapPageDescription,
    images: [ogImage]
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description: roadmapPageDescription,
    images: [ogImage.url]
  }
};

export default function RoadmapPage() {
  return (
    <main className="site-frame job-detail-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />
        <RoadmapExperience />
        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}
