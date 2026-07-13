import feedData from "@/data/jobs.json";
import {
  createJobsApiError,
  createJobResponse,
  findActiveJob,
  getJobsApiHeaders,
  jobsApiHeaders
} from "@/lib/jobs-api";
import type { JobsFeed } from "@/types/job";

const feed = feedData as JobsFeed;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = findActiveJob(feed, id);

  if (!job) {
    const body = createJobsApiError("JOB_NOT_FOUND", "Job listing not found.");
    return Response.json(body, { status: 404, headers: getJobsApiHeaders(false) });
  }

  return Response.json(
    createJobResponse(feed, job),
    { headers: jobsApiHeaders }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: jobsApiHeaders });
}
