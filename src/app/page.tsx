import type { Metadata } from "next";

import { JobBoard } from "@/components/job-board";
import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";

import { getHomeJsonLd, serializeJsonLd } from "./structured-data";

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
  const feed = feedData as JobsFeed;

  return (
    <>
      <script type="application/ld+json">
        {serializeJsonLd(getHomeJsonLd(feed))}
      </script>
      <JobBoard feed={feed} />
    </>
  );
}
