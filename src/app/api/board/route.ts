import { filterStateFromSearchParams } from "@/components/job-board/filter-url";
import feedData from "@/data/jobs.json";
import { boardCacheControl, getActiveBoardFeed, queryBoardPage } from "@/lib/board-page";
import type { JobsFeed } from "@/types/job";

export const revalidate = 3600;

export function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const body = queryBoardPage(
    getActiveBoardFeed(feedData as JobsFeed),
    filterStateFromSearchParams(parameters),
    readPage(parameters.get("page"))
  );

  return Response.json(body, { headers: { "Cache-Control": boardCacheControl } });
}

function readPage(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}
