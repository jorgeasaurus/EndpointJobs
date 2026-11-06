import { filterStateFromSearchParams } from "@/components/job-board/filter-url";
import { getMemoizedActiveBoardFeed } from "@/lib/active-board-feed";
import { boardCacheHeaders, queryBoardPage } from "@/lib/board-page";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";

export const revalidate = 3600;

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const body = queryBoardPage(
    getMemoizedActiveBoardFeed(new Date(), await getPublishedJobsFeed()),
    filterStateFromSearchParams(parameters),
    readPage(parameters.get("page"))
  );

  return Response.json(body, { headers: boardCacheHeaders });
}

function readPage(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}
