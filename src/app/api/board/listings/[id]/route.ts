import { getMemoizedActiveBoardFeed } from "@/lib/active-board-feed";
import { boardCacheControl, findBoardJob } from "@/lib/board-page";

export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = findBoardJob(getMemoizedActiveBoardFeed(), id);

  if (!job) {
    return Response.json(
      { error: "Listing not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    { description: job.description ?? null },
    { headers: { "Cache-Control": boardCacheControl } }
  );
}
