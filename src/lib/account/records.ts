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

export function jobsForBoardView<T extends { id: string }>(
  jobs: readonly T[],
  input: {
    savedIds: ReadonlySet<string>;
    savedOnly: boolean;
    viewedIds: ReadonlySet<string>;
    hideViewed: boolean;
  }
) {
  const saved = input.savedOnly ? jobs.filter((job) => input.savedIds.has(job.id)) : [...jobs];
  // Saved jobs only is the shortlist. Hide viewed still applies while browsing,
  // but a saved role stays listed after it has been opened.
  if (!input.hideViewed || input.savedOnly) return saved;
  return saved.filter((job) => !input.viewedIds.has(job.id));
}

export function presentBoardResults<T extends { id: string }>(input: {
  jobs: readonly T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  savedIds: ReadonlySet<string>;
  viewedIds: ReadonlySet<string>;
  savedOnly: boolean;
  hideViewed: boolean;
  pendingScope: boolean;
  loading: boolean;
  requestedPage: number;
}) {
  const viewingSaved = input.savedOnly && !input.pendingScope;
  const listedJobs = jobsForBoardView(input.jobs, {
    savedIds: input.savedIds,
    savedOnly: viewingSaved,
    viewedIds: input.viewedIds,
    hideViewed: input.hideViewed
  });
  const droppedOnPage = viewingSaved ? input.jobs.length - listedJobs.length : 0;
  const totalJobs = Math.max(0, input.total - droppedOnPage);
  const totalPages = viewingSaved ? Math.max(1, Math.ceil(totalJobs / input.pageSize)) : input.totalPages;
  const currentPage = input.loading ? input.requestedPage : Math.min(input.page, totalPages);
  const pageStartIndex = (currentPage - 1) * input.pageSize;

  return {
    currentPage,
    listedJobs,
    pageEnd: Math.min(pageStartIndex + input.pageSize, totalJobs),
    pageStart: totalJobs === 0 ? 0 : pageStartIndex + 1,
    totalJobs,
    totalPages,
    viewingSaved
  };
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
