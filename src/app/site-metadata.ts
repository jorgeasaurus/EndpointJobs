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

export const specialtySearchLinks = [
  { label: "Jamf jobs", href: "/?tools=Jamf" },
  { label: "Intune jobs", href: "/?tools=Intune" },
  { label: "SCCM jobs", href: "/?tools=SCCM" },
  { label: "PowerShell jobs", href: "/?tools=PowerShell" },
  { label: "macOS endpoint jobs", href: "/?platforms=macOS" },
  { label: "Windows endpoint jobs", href: "/?platforms=Windows" },
  { label: "Endpoint security jobs", href: "/?family=Endpoint%20Security" },
  { label: "Client platform jobs", href: "/?q=client%20platform" },
  { label: "Remote endpoint jobs", href: "/?workplace=Remote" }
] as const;
