import { readE2eSavedIds, savedBoardAccess } from "@/lib/account/saved-board";
import { requireAccountUser } from "@/lib/account/require-user";
import { platformChipFixturesEnabled } from "@/lib/platform-chip-fixture";

type SavedIdResult =
  | { ids: ReadonlySet<string> }
  | { error: string; status: number };

export async function savedIdsForRequest(parameters: URLSearchParams): Promise<SavedIdResult> {
  const fixtureIds = readE2eSavedIds(parameters.get("e2e-saved"), platformChipFixturesEnabled());
  if (fixtureIds) {
    const ids = savedBoardAccess({ fixtureIds, sessionIds: null });
    if (ids) return { ids };
  }

  const session = await requireAccountUser();
  if (!session) return { error: "Sign in required", status: 401 };

  const { data, error } = await session.supabase
    .from("saved_jobs")
    .select("job_id")
    .eq("user_id", session.user.id);
  if (error) return { error: "Saved jobs could not be loaded", status: 500 };

  const sessionIds = (data ?? []).flatMap((row) => (typeof row.job_id === "string" ? [row.job_id] : []));
  const ids = savedBoardAccess({ fixtureIds: null, sessionIds });
  if (!ids) return { error: "Sign in required", status: 401 };
  return { ids };
}
