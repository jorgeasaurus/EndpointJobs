import { revalidatePath, revalidateTag } from "next/cache";

import { jobsFeedCacheTag, jobsFeedRevalidateSeconds } from "@/lib/jobs-feed-config";
import { revalidatePublishedFeed } from "@/lib/published-jobs-feed";
import { isRevalidateAuthorized } from "@/lib/revalidate-auth";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isRevalidateAuthorized(request.headers.get("authorization"), process.env.REVALIDATE_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  const expectedUpdatedAt = await readExpectedUpdatedAt(request);
  const result = await revalidatePublishedFeed(expectedUpdatedAt, () => {
    revalidateTag(jobsFeedCacheTag, { expire: 0 });
    for (const path of ["/", "/board", "/jobs", "/sitemap.xml", "/api/jobs", "/api/board", "/api/board/map"]) {
      revalidatePath(path);
    }
    revalidatePath("/jobs/[id]", "page");
    revalidatePath("/[tool]", "page");
  });

  if (!result.revalidated) {
    return Response.json(
      { revalidated: false, error: "snapshot-not-ready", updatedAt: result.updatedAt },
      { status: 503, headers: noStore }
    );
  }

  return Response.json(
    { revalidated: true, revalidateSeconds: jobsFeedRevalidateSeconds, updatedAt: result.updatedAt },
    { headers: noStore }
  );
}

async function readExpectedUpdatedAt(request: Request) {
  const text = await request.text();
  if (!text.trim()) return undefined;
  try {
    const parsed = JSON.parse(text) as { updatedAt?: unknown };
    if (typeof parsed.updatedAt !== "string") return undefined;
    const updatedAt = parsed.updatedAt.trim();
    return updatedAt || undefined;
  } catch {
    return undefined;
  }
}
