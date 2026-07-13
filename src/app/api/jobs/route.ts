import feedData from "@/data/jobs.json";
import { getJobsApiHeaders, jobsApiHeaders, queryJobs } from "@/lib/jobs-api";
import type { JobsFeed } from "@/types/job";

const feed = feedData as JobsFeed;

export function GET(request: Request) {
  const result = queryJobs(feed, new URL(request.url).searchParams);
  return Response.json(result.body, {
    status: result.ok ? 200 : result.status,
    headers: getJobsApiHeaders(result.ok)
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: jobsApiHeaders });
}
