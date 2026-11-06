import {
  createJobsApiError,
  createJobResponse,
  findActiveJob,
  getJobsApiHeaders,
  jobsApiHeaders
} from "@/lib/jobs-api";
import { getPublishedJobsFeed } from "@/lib/published-jobs-feed";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [{ id }, feed] = await Promise.all([params, getPublishedJobsFeed()]);
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
