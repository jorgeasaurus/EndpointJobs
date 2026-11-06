import { filterStateFromSearchParams } from "@/components/job-board/filter-url";
import { getMemoizedActiveBoardFeed } from "@/lib/active-board-feed";
import { boardCacheHeaders, queryBoardMap } from "@/lib/board-page";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";

export const revalidate = 3600;

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const jobs = queryBoardMap(
    getMemoizedActiveBoardFeed(new Date(), await getPublishedJobsFeed()),
    filterStateFromSearchParams(parameters)
  );

  return Response.json({ jobs }, { headers: boardCacheHeaders });
}
