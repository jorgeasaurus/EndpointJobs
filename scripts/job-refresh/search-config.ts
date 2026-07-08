const powerShellSysadminSearchTerms = [
  {
    query: "powershell administrator",
    title: "PowerShell Administrator"
  },
  {
    query: "powershell systems administrator",
    title: "PowerShell Systems Administrator"
  },
  {
    query: "powershell system administrator",
    title: "PowerShell System Administrator"
  },
  {
    query: "powershell systems engineer",
    title: "PowerShell Systems Engineer"
  },
  {
    query: "powershell sysadmin",
    title: "PowerShell Sysadmin"
  },
  {
    query: "windows sysadmin powershell",
    title: "Windows Sysadmin PowerShell"
  }
];

export const powerShellSysadminSearchQueries = powerShellSysadminSearchTerms.map(
  ({ query }) => query
);

export const powerShellSysadminTitleFilters = powerShellSysadminSearchTerms.map(
  ({ title }) => title
);

export const defaultEndpointSearchQueries = [
  "endpoint engineer",
  "endpoint administrator",
  "desktop engineer",
  "desktop administrator",
  "desktop systems engineer",
  "systems engineer macos",
  "macos engineer",
  "windows engineer",
  "windows endpoint engineer",
  "client platform engineer",
  "client platform",
  "client infrastructure engineer",
  "client infrastructure",
  "client engineering",
  "end user computing engineer",
  "digital workplace engineer",
  "digital workplace",
  "employee experience engineer",
  "employee experience technology",
  "digital employee experience",
  "corporate engineering",
  "enterprise engineering",
  "device trust engineer",
  "device trust",
  "zero-touch deployment",
  "zero touch deployment",
  "it systems engineer",
  "tech operations engineer",
  "tech operations",
  "technology operations engineer",
  "workplace engineer",
  ...powerShellSysadminSearchQueries,
  "intune engineer",
  "jamf engineer",
  "sccm engineer",
  "mdm engineer"
];

export const monitoredCompanyNames = [
  "Kandji",
  "Fleet",
  "NinjaOne",
  "Addigy",
  "Mosyle",
  "CrowdStrike",
  "SentinelOne",
  "Palo Alto Networks",
  "1Password",
  "Bitwarden",
  "BeyondTrust",
  "Apple",
  "Microsoft",
  "Adobe",
  "Salesforce",
  "ServiceNow",
  "Block",
  "Capital One",
  "Bloomberg",
  "Netflix"
];

export const defaultCompanyJobQueries = monitoredCompanyNames.map(
  (company) => `${company} endpoint engineer`
);
