/** The `jobId` string from a JSON request body, or "" when the body has none. */
export async function readJobId(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null && "jobId" in body && typeof body.jobId === "string" ? body.jobId : "";
}
