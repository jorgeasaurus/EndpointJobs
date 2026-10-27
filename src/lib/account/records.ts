export const deleteAccountConfirmation = "delete my account";

export function deletionConfirmed(value: unknown) {
  return value === deleteAccountConfirmation;
}

export type SavedJobSnapshot = {
  title: string;
  company: string;
  location: string;
  sourceUrl: string;
};

export function savedJobSnapshot(job: SavedJobSnapshot): SavedJobSnapshot {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    sourceUrl: job.sourceUrl
  };
}

export function hideViewedJobs<T extends { id: string }>(
  jobs: readonly T[],
  viewedIds: ReadonlySet<string>,
  hideViewed: boolean
) {
  if (!hideViewed) return [...jobs];
  return jobs.filter((job) => !viewedIds.has(job.id));
}

export type AccountExport = {
  exportedAt: string;
  profile: unknown;
  preferences: unknown;
  savedJobs: unknown;
  jobViews: unknown;
};

export function buildAccountExport(document: AccountExport): AccountExport {
  return {
    exportedAt: document.exportedAt,
    profile: document.profile,
    preferences: document.preferences,
    savedJobs: document.savedJobs,
    jobViews: document.jobViews
  };
}
