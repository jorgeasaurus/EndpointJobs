import { getJobsApiHeaders, jobsApiHeaders, queryJobs } from "@/lib/jobs-api";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";

export async function GET(request: Request) {
  const result = queryJobs(await getPublishedJobsFeed(), new URL(request.url).searchParams);
  return Response.json(result.body, {
    status: result.ok ? 200 : result.status,
    headers: getJobsApiHeaders(result.ok)
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: jobsApiHeaders });
}
