import type { Job } from "../../src/types/job";

export type ProviderFetchContext = {
  url: string;
  fetchedAt: Date;
  /**
   * This provider's jobs from the last published feed, when it could be
   * loaded. Providers may carry these forward for a part of their snapshot
   * that is temporarily unreachable; undefined means no fallback exists.
   */
  previousJobs?: readonly Job[];
};

export type ProviderAdapter<Id extends string = string> = {
  id: Id;
  displayName: string;
  defaultUrl: string;
  reserveFeedSlots?: boolean;
  fetchJobs: (context: ProviderFetchContext) => Promise<Array<Job | null>>;
};
