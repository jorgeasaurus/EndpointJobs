import { JobBoard } from "@/components/job-board";
import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";

import { getHomeJsonLd, serializeJsonLd } from "./structured-data";

export default function Home() {
  const feed = feedData as JobsFeed;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(getHomeJsonLd(feed)) }}
      />
      <JobBoard feed={feed} />
    </>
  );
}
