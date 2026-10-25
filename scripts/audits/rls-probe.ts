const DEFAULT_LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "EAI_AGAIN",
  "ENETUNREACH"
]);

export type DatabaseProbeOutcome = "run" | "skip" | "fail";

export function resolveDatabaseConnection(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): {
  connectionString: string;
  explicitUrl: boolean;
} {
  const configured = env.SUPABASE_DB_URL;
  if (typeof configured === "string" && configured.trim()) {
    return { connectionString: configured, explicitUrl: true };
  }
  return { connectionString: DEFAULT_LOCAL_DB_URL, explicitUrl: false };
}

export function classifyDatabaseProbe(explicitUrl: boolean, error: unknown | null): DatabaseProbeOutcome {
  if (!error) return "run";
  if (explicitUrl) return "fail";
  if (isUnreachableDatabaseError(error)) return "skip";
  return "fail";
}

export async function probeDatabase(options: {
  explicitUrl: boolean;
  connect: () => Promise<void>;
}): Promise<{ outcome: DatabaseProbeOutcome; reason: string }> {
  try {
    await options.connect();
    return { outcome: "run", reason: "" };
  } catch (error) {
    const outcome = classifyDatabaseProbe(options.explicitUrl, error);
    const message = error instanceof Error ? error.message : String(error);
    if (outcome === "skip") return { outcome, reason: "local Supabase is not accepting connections" };
    return { outcome: "fail", reason: `database probe failed: ${message}` };
  }
}

function isUnreachableDatabaseError(error: unknown): boolean {
  const code = errorCode(error);
  if (UNREACHABLE_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH|EAI_AGAIN|ENETUNREACH|timeout expired|connection timeout/i.test(message);
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : "";
}
