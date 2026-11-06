import type { Metadata } from "next";

import { JobBoard } from "@/components/job-board";
import { initialFilterState } from "@/components/job-board/filter-model";
import { getActiveBoardFeed, queryBoardPage } from "@/lib/board-page";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";

import { getBoardPath, siteUrl } from "../site-metadata";
import { getHomeJsonLd, serializeJsonLd } from "../structured-data";

// Daily backstop. The refresh workflow revalidates this route after publishing the feed.
export const revalidate = 86400;

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

export default async function BoardPage() {
  const activeFeed = getActiveBoardFeed(await getPublishedJobsFeed());
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
