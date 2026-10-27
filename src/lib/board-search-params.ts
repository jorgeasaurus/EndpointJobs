/** Board query keys with no app imports, so the proxy bundle can stay small. */

export const filterSearchParams = {
  query: "q",
  locationQuery: "location",
  selectedPlatforms: "platforms",
  selectedTools: "tools",
  selectedMetroAreas: "metroAreas",
  workplace: "workplace",
  sponsorship: "sponsorship",
  salaryOnly: "salary",
  leadershipOnly: "leadership",
  minimumSalary: "minSalary",
  seniority: "seniority",
  roleFamily: "family",
  freshness: "freshness",
  sort: "sort"
} as const;

export const legacyFilterSearchParamKeys = ["locations", "remote"] as const;

export const filterSearchParamKeys = [
  ...Object.values(filterSearchParams),
  ...legacyFilterSearchParamKeys
];

export const boardHomeRedirectKeys = new Set<string>([
  ...filterSearchParamKeys,
  "page"
]);
