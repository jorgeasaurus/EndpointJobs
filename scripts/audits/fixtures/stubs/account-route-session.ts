/**
 * Stands in for `@/lib/account/require-user`: user-1 is signed in unless a
 * test signs out, and every database write the routes make is logged.
 */
export const writes: { table?: string; rpc?: string; values: Record<string, unknown> }[] = [];

let signedIn = true;

export function setSignedIn(value: boolean) {
  signedIn = value;
}

const supabase = {
  from: (table: string) => ({
    upsert: async (values: Record<string, unknown>) => {
      writes.push({ table, values });
      return { error: null };
    }
  }),
  rpc: async (name: string, values: Record<string, unknown>) => {
    writes.push({ rpc: name, values });
    return { error: null };
  }
};

export async function requireAccountUser() {
  return signedIn ? { supabase, user: { id: "user-1" } } : null;
}
