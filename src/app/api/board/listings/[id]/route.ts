import feedData from "@/data/jobs.json";
import { boardCacheControl, findBoardJob, getActiveBoardFeed } from "@/lib/board-page";
import type { JobsFeed } from "@/types/job";

export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = findBoardJob(getActiveBoardFeed(feedData as JobsFeed), id);

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
