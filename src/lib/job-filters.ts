import { getPostedAgeDays, getSalarySortValue, getSearchText } from "@/lib/jobs";
import type { EndpointTool, Job, Platform, RoleFamily, Seniority, Workplace } from "@/types/job";

export type SortKey = "newest" | "salary" | "company";
export type FreshnessFilter = "Any" | "7" | "14" | "30";
export const minimumSalaryFilterValues = ["Any", "80000", "100000", "120000", "150000", "180000", "200000"] as const;
export type MinimumSalaryFilter = (typeof minimumSalaryFilterValues)[number];
export type JobFilters = {
  query: string;
  locationQuery: string;
  selectedPlatforms: Platform[];
  selectedTools: EndpointTool[];
  workplace: "Any" | Exclude<Workplace, "Unknown">;
  salaryOnly: boolean;
  minimumSalary: MinimumSalaryFilter;
  seniority: "All" | Seniority;
  roleFamily: "All" | RoleFamily;
  freshness: FreshnessFilter;
  sort: SortKey;
};

export function filterJobs(jobs: Job[], filters: JobFilters) {
  const query = filters.query.trim().toLowerCase();
  const location = normalize(`${filters.locationQuery}`);
  const minimumSalary = filters.minimumSalary === "Any" ? null : Number(filters.minimumSalary);
  const maximumAge = filters.freshness === "Any" ? null : Number(filters.freshness);
  return jobs.filter((job) => {
    if (query && !getSearchText(job).includes(query)) return false;
    if (location && !normalize(`${job.location} ${job.mapLocation?.label ?? ""} ${job.workplace}`).includes(location)) return false;
    if (filters.selectedPlatforms.length && !filters.selectedPlatforms.some((value) => job.platforms.includes(value))) return false;
    if (filters.selectedTools.length && !filters.selectedTools.some((value) => job.tools.includes(value))) return false;
    if (filters.workplace !== "Any" && job.workplace !== filters.workplace) return false;
    if (filters.salaryOnly && typeof job.salary?.min !== "number" && typeof job.salary?.max !== "number") return false;
    if (minimumSalary !== null && (job.salary?.currency !== "USD" || (job.salary.max ?? job.salary.min ?? 0) < minimumSalary)) return false;
    if (filters.seniority !== "All" && job.seniority !== filters.seniority) return false;
    if (filters.roleFamily !== "All" && job.roleFamily !== filters.roleFamily) return false;
    return maximumAge === null || getPostedAgeDays(job.postedAt) <= maximumAge;
  }).sort((a, b) => filters.sort === "salary"
    ? getSalarySortValue(b) - getSalarySortValue(a)
    : filters.sort === "company"
      ? a.company.localeCompare(b.company)
      : new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}

function normalize(value: string) {
  return value.normalize("NFC").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim().toLowerCase();
}
