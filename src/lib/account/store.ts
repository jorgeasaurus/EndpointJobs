import { decodePreferences, type SavedPreferences } from "./preferences";
import { savedJobSnapshot, type SavedJobSnapshot } from "./records";

type ErrorResult = { error: { message: string } | null; data?: unknown };

/** One user's rows: awaited directly, as a single row, or ordered. */
type UserRowsQuery = {
  eq: (column: string, value: string) => Promise<ErrorResult> & {
    maybeSingle: () => Promise<ErrorResult>;
    order: (column: string, options: { ascending: boolean }) => Promise<ErrorResult>;
  };
};

/** Reads only; account writes go through the `/api/account/*` routes (see `requests.ts`). */
export type AccountClient = {
  from: (table: string) => {
    select: (columns: string) => UserRowsQuery;
  };
};

export async function readPreferences(client: AccountClient, userId: string): Promise<SavedPreferences | null> {
  const result = await client
    .from("user_preferences")
    .select("filters, schema_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error || !result.data || typeof result.data !== "object") return null;
  const row = result.data as { filters?: unknown; schema_version?: unknown };
  if (row.schema_version !== undefined && row.schema_version !== 1) return null;
  return decodePreferences(row.filters);
}

export async function listViewedIds(client: AccountClient, userId: string) {
  const result = await client.from("job_views").select("job_id").eq("user_id", userId);
  return idsFrom(result.data);
}

export async function listSavedJobs(client: AccountClient, userId: string) {
  const result = await client
    .from("saved_jobs")
    .select("job_id, job_snapshot, saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as { job_id?: unknown; job_snapshot?: unknown; saved_at?: unknown };
    if (typeof record.job_id !== "string") return [];
    const snapshot = record.job_snapshot;
    const saved = snapshot && typeof snapshot === "object" ? snapshot as Partial<SavedJobSnapshot> : {};
    return [{
      jobId: record.job_id,
      savedAt: typeof record.saved_at === "string" ? record.saved_at : "",
      snapshot: savedJobSnapshot({
        title: typeof saved.title === "string" ? saved.title : record.job_id,
        company: typeof saved.company === "string" ? saved.company : "",
        location: typeof saved.location === "string" ? saved.location : "",
        sourceUrl: typeof saved.sourceUrl === "string" ? saved.sourceUrl : ""
      })
    }];
  });
}

export async function listSavedIds(client: AccountClient, userId: string) {
  const saved = await listSavedJobs(client, userId);
  return saved.map((job) => job.jobId);
}

function idsFrom(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const id = (row as { job_id?: unknown }).job_id;
    return typeof id === "string" ? [id] : [];
  });
}
