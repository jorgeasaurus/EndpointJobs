export const ROADMAP_PROGRESS_STORAGE_KEY = "endpointjobs.roadmap.completed.v1";

const ROADMAP_PROGRESS_EVENT = "endpointjobs-roadmap-change";

const emptyCompleted: ReadonlySet<string> = new Set();

export type RoadmapCompletion = {
  completed: number;
  total: number;
  percent: number;
};

export function parseCompletedSkillIds(raw: string | null, knownIds: ReadonlySet<string>): Set<string> {
  if (!raw) return new Set();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Set();
  }

  if (!Array.isArray(parsed)) return new Set();

  const ids = new Set<string>();
  for (const value of parsed) {
    if (typeof value === "string" && knownIds.has(value)) ids.add(value);
  }
  return ids;
}

export function serializeCompletedSkillIds(ids: ReadonlySet<string>): string {
  return JSON.stringify([...ids].sort());
}

export function toggleSkillId(
  current: ReadonlySet<string>,
  skillId: string,
  knownIds: ReadonlySet<string>
): ReadonlySet<string> {
  if (!knownIds.has(skillId)) return current;
  const next = new Set(current);
  if (next.has(skillId)) next.delete(skillId);
  else next.add(skillId);
  return next;
}

export function completionFor(skillIds: readonly string[], completed: ReadonlySet<string>): RoadmapCompletion {
  const total = skillIds.length;
  let done = 0;
  for (const skillId of skillIds) {
    if (completed.has(skillId)) done += 1;
  }
  return {
    completed: done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100)
  };
}

type ProgressStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function loadCompletedSkillIds(storage: ProgressStorage, knownIds: ReadonlySet<string>): Set<string> {
  try {
    return parseCompletedSkillIds(storage.getItem(ROADMAP_PROGRESS_STORAGE_KEY), knownIds);
  } catch {
    return new Set();
  }
}

export function saveCompletedSkillIds(storage: ProgressStorage, ids: ReadonlySet<string>): boolean {
  try {
    storage.setItem(ROADMAP_PROGRESS_STORAGE_KEY, serializeCompletedSkillIds(ids));
    return true;
  } catch {
    return false;
  }
}

// useSyncExternalStore repeats getSnapshot until the returned value is stable.
let cachedRaw: string | null | undefined;
let cachedCompleted: ReadonlySet<string> = emptyCompleted;

export function roadmapProgressServerSnapshot(): ReadonlySet<string> {
  return emptyCompleted;
}

export function readRoadmapProgress(knownIds: ReadonlySet<string>): ReadonlySet<string> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(ROADMAP_PROGRESS_STORAGE_KEY);
  } catch {
    return emptyCompleted;
  }

  if (raw === cachedRaw) return cachedCompleted;
  cachedRaw = raw;
  const parsed = parseCompletedSkillIds(raw, knownIds);
  cachedCompleted = parsed.size === 0 ? emptyCompleted : parsed;
  return cachedCompleted;
}

export function subscribeRoadmapProgress(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(ROADMAP_PROGRESS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(ROADMAP_PROGRESS_EVENT, onStoreChange);
  };
}

export function toggleStoredRoadmapSkill(skillId: string, knownIds: ReadonlySet<string>): void {
  const current = readRoadmapProgress(knownIds);
  const next = toggleSkillId(current, skillId, knownIds);
  if (next === current) return;
  if (!saveCompletedSkillIds(window.localStorage, next)) return;
  cachedRaw = serializeCompletedSkillIds(next);
  cachedCompleted = next.size === 0 ? emptyCompleted : next;
  window.dispatchEvent(new Event(ROADMAP_PROGRESS_EVENT));
}
