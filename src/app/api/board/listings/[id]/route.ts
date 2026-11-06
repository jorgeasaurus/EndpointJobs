import { getMemoizedActiveBoardFeed } from "@/lib/active-board-feed";
import { boardCacheHeaders, findBoardJob } from "@/lib/board-page";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";

export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = findBoardJob(getMemoizedActiveBoardFeed(new Date(), await getPublishedJobsFeed()), id);

  if (!job) {
    return Response.json(
      { error: "Listing not found" },
      { status: 404, headers: { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    { description: job.description ?? null },
    { headers: boardCacheHeaders }
  );
}
