import { filterStateFromSearchParams } from "@/components/job-board/filter-url";
import { savedIdsForRequest } from "@/app/api/board/saved/saved-ids";
import { getMemoizedActiveBoardFeed } from "@/lib/active-board-feed";
import { queryBoardPage } from "@/lib/board-page";

export const dynamic = "force-dynamic";

const privateCache = "private, no-store";

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const saved = await savedIdsForRequest(parameters);
  if (!("ids" in saved)) {
    return Response.json({ error: saved.error }, { status: saved.status, headers: { "Cache-Control": privateCache } });
  }

  const body = queryBoardPage(
    getMemoizedActiveBoardFeed(),
    filterStateFromSearchParams(parameters),
    readPage(parameters.get("page")),
    undefined,
    saved.ids
  );

  return Response.json(body, { headers: { "Cache-Control": privateCache } });
}

function readPage(value: string | null) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}
