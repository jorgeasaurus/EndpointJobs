import { filterStateFromSearchParams } from "@/components/job-board/filter-url";
import { getMemoizedActiveBoardFeed } from "@/lib/active-board-feed";
import { boardCacheControl, queryBoardMap } from "@/lib/board-page";

export const revalidate = 3600;

export function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const jobs = queryBoardMap(
    getMemoizedActiveBoardFeed(),
    filterStateFromSearchParams(parameters)
  );

  return Response.json({ jobs }, { headers: { "Cache-Control": boardCacheControl } });
}
