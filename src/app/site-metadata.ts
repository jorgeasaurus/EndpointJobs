import type { Route } from "next";

export const siteUrl = "https://endpointjobs.dev";
export const siteName = "Endpoint Jobs";
export const siteTitle =
  "Endpoint Engineering Jobs | Jamf, Intune, macOS & Windows Roles";
export const siteDescription =
  "Find daily refreshed endpoint engineering jobs across macOS, Windows, MDM, UEM, Jamf, Intune, SCCM, client platform, digital workplace, and endpoint security roles.";
export const siteKeywords = [
  "Endpoint Engineering jobs",
  "macOS engineer jobs",
  "Windows endpoint engineer jobs",
  "Jamf jobs",
  "Intune jobs",
  "SCCM jobs",
  "PowerShell jobs",
  "MDM jobs",
  "UEM jobs",
  "client platform engineer jobs",
  "endpoint security jobs",
  "digital workplace jobs"
];
export const ogImage = {
  url: "/og-image.png",
  width: 1200,
  height: 675,
  alt: "Endpoint Jobs social card with endpoint engineering job board details"
};
export const repositoryUrl = "https://github.com/jorgeasaurus/EndpointJobs";

// These helpers build internal app routes consumed by <Link> and
// permanentRedirect, both of which are typed against Next's `Route` brand. The
// brand only admits statically-known relative segments, so dynamic paths have to
// be asserted into `Route`. The values are valid runtime routes; the assertion is
// purely a type-system accommodation, not a behavioral contract.
export function getJobPath(jobId: string): Route {
  return `/jobs/${encodeURIComponent(jobId)}` as Route;
}

export function getJobUrl(jobId: string) {
  return new URL(getJobPath(jobId), siteUrl).toString();
}

export function getJobsDirectoryPath(page = 1): Route {
  return (page > 1 ? `/jobs?page=${page}` : "/jobs") as Route;
}
