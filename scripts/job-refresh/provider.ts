import type { Job } from "../../src/types/job";

export type ProviderFetchContext = {
  url: string;
  fetchedAt: Date;
};

export type ProviderAdapter<Id extends string = string> = {
  id: Id;
  displayName: string;
  defaultUrl: string;
  fetchJobs: (context: ProviderFetchContext) => Promise<Array<Job | null>>;
};
