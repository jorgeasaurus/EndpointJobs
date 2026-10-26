import type { FilterState } from "./filter-model";

export function getEmptyResultsMessage(filters: FilterState) {
  const query = filters.query.trim();
  const reasons: string[] = [];

  if (query) reasons.push(`search “${query}”`);
  if (filters.locationQuery.trim()) reasons.push(`location “${filters.locationQuery.trim()}”`);
  if (filters.selectedTools.length > 0) reasons.push("tool filters");
  if (filters.selectedPlatforms.length > 0) reasons.push("platform filters");
  if (filters.selectedMetroAreas.length > 0) reasons.push("metro areas");
  if (filters.workplace !== "Any") reasons.push(`${filters.workplace} workplace`);
  if (filters.seniority !== "All") reasons.push(`${filters.seniority} seniority`);
  if (filters.roleFamily !== "All") reasons.push(filters.roleFamily);
  if (filters.freshness !== "Any") reasons.push("a freshness window");
  if (filters.salaryOnly) reasons.push("salary shown");
  if (filters.leadershipOnly) reasons.push("leadership");
  if (filters.minimumSalary !== "Any") reasons.push("a minimum salary");
  if (filters.sponsorship !== "Any") reasons.push("visa sponsorship");

  if (reasons.length === 0) {
    return "Try fewer tool filters or search for a broader platform term.";
  }

  return `Nothing matches ${reasons.join(", ")}. Broaden the search or reset filters.`;
}
