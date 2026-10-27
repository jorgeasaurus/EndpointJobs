import { filterStateFromSearchParams } from "@/components/job-board/filter-url";
import feedData from "@/data/jobs.json";
import { boardCacheControl, getActiveBoardFeed, queryBoardMap } from "@/lib/board-page";
import type { JobsFeed } from "@/types/job";

export const revalidate = 3600;

export function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const jobs = queryBoardMap(
    getActiveBoardFeed(feedData as JobsFeed),
    filterStateFromSearchParams(parameters)
  );

  return Response.json({ jobs }, { headers: { "Cache-Control": boardCacheControl } });
}
