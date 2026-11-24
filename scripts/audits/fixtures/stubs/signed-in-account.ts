/**
 * Stands in for `@/lib/supabase/client`, `@/lib/supabase/env` and
 * `@/components/auth/sign-in-session`: user-1 is signed in with one saved and
 * one viewed job and no stored preferences. Every account read is logged.
 */
export const accountReads: string[] = [];

type Result = { error: null; data: unknown };
type Query = Promise<Result> & {
  eq: () => Query;
  maybeSingle: () => Promise<Result>;
  order: () => Promise<Result>;
};

const rows: Record<string, unknown> = {
  user_preferences: null,
  job_views: [{ job_id: "job-2" }],
  saved_jobs: [{ job_id: "job-1", job_snapshot: {}, saved_at: "2026-10-27T00:00:00.000Z" }]
};

function query(result: Promise<Result>): Query {
  return Object.assign(result, { eq: () => query(result), maybeSingle: () => result, order: () => result });
}

export function createClient() {
  return {
    from: (table: string) => ({
      select: () => {
        accountReads.push(table);
        return query(Promise.resolve({ error: null, data: rows[table] }));
      }
    })
  };
}

export function isSupabaseConfigured() {
  return true;
}

// One object, like the real store's snapshot, so the session keeps its identity across renders.
const session = { configured: true, email: "user-1@example.com", userId: "user-1" };

export function useSignInSession() {
  return session;
}
