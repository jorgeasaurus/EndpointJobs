import type { Metadata } from "next";

import { JobBoard } from "@/components/job-board";
import feedData from "@/data/jobs.json";
import { prepareBoardFeed } from "@/lib/job-trust";
import type { JobsFeed } from "@/types/job";

import { getHomeJsonLd, serializeJsonLd } from "./structured-data";

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
  const activeFeed = prepareBoardFeed(feedData as JobsFeed);

  return (
    <>
      <script type="application/ld+json">
        {serializeJsonLd(getHomeJsonLd(activeFeed))}
      </script>
      <JobBoard feed={activeFeed} />
    </>
  );
}
