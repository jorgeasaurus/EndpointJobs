import { filterStateFromSearchParams } from "@/components/job-board/filter-url";
import { savedIdsForRequest } from "@/app/api/board/saved/saved-ids";
import { getMemoizedActiveBoardFeed } from "@/lib/active-board-feed";
import { queryBoardMap } from "@/lib/board-page";

export const dynamic = "force-dynamic";

const privateCache = "private, no-store";

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const saved = await savedIdsForRequest(parameters);
  if (!("ids" in saved)) {
    return Response.json({ error: saved.error }, { status: saved.status, headers: { "Cache-Control": privateCache } });
  }

  const jobs = queryBoardMap(
    getMemoizedActiveBoardFeed(),
    filterStateFromSearchParams(parameters),
    saved.ids
  );

  return Response.json({ jobs }, { headers: { "Cache-Control": privateCache } });
}
