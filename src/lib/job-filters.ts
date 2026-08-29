import { getSalarySortValue, getSearchText, isPostedWithinDays } from "@/lib/jobs";
import { isLeadershipTitle } from "@/lib/job-taxonomy";
import { metroAreaMatcher, type MetroAreaFilter } from "@/lib/metro-areas";
import { foldTokens } from "@/lib/text";
import { getJobWorkplace } from "@/lib/workplace";
import type { EndpointTool, Job, Platform, RoleFamily, Seniority, Workplace } from "@/types/job";

export type SortKey = "newest" | "salary" | "company";
export const freshnessFilterDayValues = ["1", "7", "14", "30"] as const;
export const freshnessFilterValues = ["Any", ...freshnessFilterDayValues] as const;
export type FreshnessFilter = (typeof freshnessFilterValues)[number];
const freshnessFilterValueSet: ReadonlySet<string> = new Set(freshnessFilterValues);
export const minimumSalaryFilterValues = ["Any", "80000", "100000", "120000", "150000", "180000", "200000"] as const;
export type MinimumSalaryFilter = (typeof minimumSalaryFilterValues)[number];

export { isMetroAreaFilter, metroAreaOptions } from "@/lib/metro-areas";
export type { MetroAreaFilter } from "@/lib/metro-areas";

export type JobFilters = {
  query: string;
  locationQuery: string;
  selectedPlatforms: Platform[];
  selectedTools: EndpointTool[];
  selectedMetroAreas: MetroAreaFilter[];
  workplace: "Any" | Exclude<Workplace, "Unknown">;
  salaryOnly: boolean;
  leadershipOnly: boolean;
  minimumSalary: MinimumSalaryFilter;
  seniority: "All" | Seniority;
  roleFamily: "All" | RoleFamily;
  freshness: FreshnessFilter;
  sort: SortKey;
};

export function isFreshnessFilter(value: string): value is FreshnessFilter {
  return freshnessFilterValueSet.has(value);
}

export function isLeadershipJob(job: Pick<Job, "title">) {
  return isLeadershipTitle(job.title);
}

export function filterJobs(jobs: Job[], filters: JobFilters, now = new Date()) {
  const query = filters.query.trim().toLowerCase();
  const location = foldTokens(filters.locationQuery);
  const selectedPlatforms = new Set(filters.selectedPlatforms);
  const selectedTools = new Set(filters.selectedTools);
  const minimumSalary = filters.minimumSalary === "Any" ? null : Number(filters.minimumSalary);
  const maximumAgeDays = filters.freshness === "Any" ? null : Number(filters.freshness);
  return jobs.filter((job) => {
    const workplace = getJobWorkplace(job);
    if (query && !getSearchText(job).includes(query)) return false;
    if (location) {
      const locationHaystack = `${foldTokens(`${job.location} ${job.mapLocation?.label ?? ""} ${workplace}`)}`;
      if (!locationHaystack.includes(location)) return false;
    }
    if (selectedPlatforms.size && !job.platforms.some((value) => selectedPlatforms.has(value))) return false;
    if (selectedTools.size && !job.tools.some((value) => selectedTools.has(value))) return false;
    if (filters.selectedMetroAreas.length && !filters.selectedMetroAreas.some((metro) => metroAreaMatcher.matches(job, metro))) return false;
    if (filters.workplace !== "Any" && workplace !== filters.workplace) return false;
    if (filters.salaryOnly && typeof job.salary?.min !== "number" && typeof job.salary?.max !== "number") return false;
    if (filters.leadershipOnly && !isLeadershipJob(job)) return false;
    if (minimumSalary !== null && (job.salary?.currency !== "USD" || (job.salary.max ?? job.salary.min ?? 0) < minimumSalary)) return false;
    if (filters.seniority !== "All" && job.seniority !== filters.seniority) return false;
    if (filters.roleFamily !== "All" && job.roleFamily !== filters.roleFamily) return false;
    return maximumAgeDays === null || isPostedWithinDays(job.postedAt, maximumAgeDays, now);
  }).sort((a, b) => filters.sort === "salary"
    ? getSalarySortValue(b) - getSalarySortValue(a)
    : filters.sort === "company"
      ? a.company.localeCompare(b.company)
      : new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}
