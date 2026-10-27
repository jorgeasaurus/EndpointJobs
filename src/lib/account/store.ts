import type { FilterState } from "@/components/job-board/filter-model";

import { decodePreferences, preferenceRow, type SavedPreferences } from "./preferences";
import { savedJobSnapshot, type SavedJobSnapshot } from "./records";

type ErrorResult = { error: { message: string } | null; data?: unknown };

type EqQuery = {
  eq: (column: string, value: string) => EqQuery & Promise<ErrorResult> & {
    eq: (column: string, value: string) => Promise<ErrorResult>;
    maybeSingle: () => Promise<ErrorResult>;
    order: (column: string, options: { ascending: boolean }) => Promise<ErrorResult>;
  };
};

export type AccountClient = {
  from: (table: string) => {
    upsert: (values: unknown, options: { onConflict: string }) => Promise<ErrorResult>;
    insert: (values: unknown) => Promise<ErrorResult>;
    select: (columns: string) => EqQuery;
    delete: () => EqQuery;
  };
  rpc: (name: string, args: { p_job_id: string }) => Promise<ErrorResult>;
};

export async function upsertPreferences(
  client: AccountClient,
  userId: string,
  filters: FilterState,
  hideViewed: boolean,
  updatedAt: string,
  savedOnly = false
) {
  return client.from("user_preferences").upsert(
    preferenceRow(userId, filters, hideViewed, updatedAt, savedOnly),
    { onConflict: "user_id" }
  );
}

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

export async function recordJobView(client: AccountClient, jobId: string) {
  return client.rpc("record_job_view", { p_job_id: jobId });
}

export async function listViewedIds(client: AccountClient, userId: string) {
  const result = await client.from("job_views").select("job_id").eq("user_id", userId);
  return idsFrom(result.data);
}

export async function clearJobViews(client: AccountClient, userId: string) {
  return client.from("job_views").delete().eq("user_id", userId);
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

export async function saveJob(client: AccountClient, userId: string, job: SavedJobSnapshot & { id: string }) {
  return client.from("saved_jobs").upsert({
    user_id: userId,
    job_id: job.id,
    job_snapshot: savedJobSnapshot(job),
    saved_at: new Date().toISOString()
  }, { onConflict: "user_id,job_id" });
}

export async function unsaveJob(client: AccountClient, userId: string, jobId: string) {
  return client.from("saved_jobs").delete().eq("user_id", userId).eq("job_id", jobId);
}

function idsFrom(data: unknown) {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const id = (row as { job_id?: unknown }).job_id;
    return typeof id === "string" ? [id] : [];
  });
}
