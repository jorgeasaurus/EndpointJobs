export function readE2eSavedIds(value: string | null, fixturesEnabled: boolean): ReadonlySet<string> | null {
  if (!fixturesEnabled || value === null) return null;
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

/** Fixture ids win so harnesses can run without a session. Otherwise only the caller's rows are used. */
export function savedBoardAccess(input: {
  fixtureIds: ReadonlySet<string> | null;
  sessionIds: readonly string[] | null;
}): ReadonlySet<string> | null {
  if (input.fixtureIds) return input.fixtureIds;
  if (input.sessionIds) return new Set(input.sessionIds);
  return null;
}
