/**
 * Stands in for `@/lib/supabase/client` and `@/components/auth/sign-in-session`:
 * user-1 is signed in with one saved and one viewed job and no stored
 * preferences. Every account read is logged.
 */
import type { SignInSession } from "@/lib/auth/session";

export const accountReads: string[] = [];

const rows: Record<string, unknown> = {
  user_preferences: null,
  job_views: [{ job_id: "job-2" }],
  saved_jobs: [{ job_id: "job-1", job_snapshot: {}, saved_at: "2026-10-27T00:00:00.000Z" }]
};

export function createClient() {
  return {
    from: (table: string) => ({
      select: () => {
        accountReads.push(table);
        const result = Promise.resolve({ error: null, data: rows[table] });
        return { eq: () => Object.assign(result, { maybeSingle: () => result, order: () => result }) };
      }
    })
  };
}

// One object, like the real store's snapshot, so the account keeps its identity across renders.
const session: SignInSession = {
  configured: true,
  account: { kind: "account", userId: "user-1", email: "user-1@example.com" }
};

export function useSignInSession() {
  return session;
}
