import type { Metadata } from "next";

import { JobBoard } from "@/components/job-board";
import { initialFilterState } from "@/components/job-board/filter-model";
import feedData from "@/data/jobs.json";
import { getActiveBoardFeed, queryBoardPage } from "@/lib/board-page";
import type { JobsFeed } from "@/types/job";

import { getBoardPath, siteUrl } from "../site-metadata";
import { getHomeJsonLd, serializeJsonLd } from "../structured-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Job board",
  alternates: { canonical: new URL(getBoardPath(), siteUrl).toString() },
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

export default function BoardPage() {
  const activeFeed = getActiveBoardFeed(feedData as JobsFeed);
  const initialPage = queryBoardPage(activeFeed, initialFilterState, 1);

  return (
    <>
      <script type="application/ld+json">
        {serializeJsonLd(getHomeJsonLd(activeFeed))}
      </script>
      <JobBoard initialPage={initialPage} />
    </>
  );
}
