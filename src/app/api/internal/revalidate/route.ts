import { revalidatePath, revalidateTag } from "next/cache";

import { jobsFeedRevalidateSeconds } from "@/lib/jobs-feed-config";
import { isRevalidateAuthorized } from "@/lib/revalidate-auth";

export const dynamic = "force-dynamic";

const jobsFeedTag = "jobs-feed";
const noStore = { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isRevalidateAuthorized(request.headers.get("authorization"), process.env.REVALIDATE_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  revalidateTag(jobsFeedTag, { expire: 0 });
  for (const path of ["/", "/board", "/jobs", "/sitemap.xml", "/api/jobs", "/api/board", "/api/board/map"]) {
    revalidatePath(path);
  }
  revalidatePath("/jobs/[id]", "page");
  revalidatePath("/[tool]", "page");

  return Response.json(
    { revalidated: true, revalidateSeconds: jobsFeedRevalidateSeconds },
    { headers: noStore }
  );
}
