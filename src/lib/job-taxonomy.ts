import { normalizeTokens } from "@/lib/text";

export const endpointToolDefinitions = [
  { tool: "Jamf", aliases: ["jamf", "jamf pro", "jamf school"], strong: true },
  {
    tool: "Intune",
    aliases: ["intune", "endpoint manager", "microsoft endpoint manager"],
    strong: true
  },
  {
    tool: "SCCM",
    aliases: ["sccm", "mecm", "configuration manager", "configmgr"],
    strong: true
  },
  {
    tool: "Fleet MDM",
    aliases: ["fleet mdm", "fleetdm", "fleet device management"],
    strong: true
  },
  { tool: "Kandji", aliases: ["kandji", "kanji"], strong: true },
  { tool: "NinjaOne", aliases: ["ninjaone", "ninja one"], strong: true },
  {
    tool: "Workspace ONE",
    aliases: ["workspace one", "workspaceone", "airwatch"],
    strong: true
  },
  { tool: "Tanium", aliases: ["tanium"], strong: true },
  { tool: "Okta", aliases: ["okta"], strong: false },
  { tool: "Entra ID", aliases: ["entra id", "entra", "azure ad"], strong: false },
  { tool: "Autopilot", aliases: ["autopilot", "windows autopilot"], strong: true },
  { tool: "PowerShell", aliases: ["powershell", "power shell", "pwsh"], strong: true },
  { tool: "Defender", aliases: ["defender", "microsoft defender", "mde"], strong: false }
] as const;

export type EndpointTool = (typeof endpointToolDefinitions)[number]["tool"];

export const endpointToolOptions: EndpointTool[] = endpointToolDefinitions.map(
  ({ tool }) => tool
);

export const platformDefinitions = [
  { platform: "macOS", aliases: ["macos", "mac os", "mac admin", "apple device"] },
  { platform: "Windows", aliases: ["windows", "windows 10", "windows 11"] },
  { platform: "iOS", aliases: ["ios", "iphone", "ipad"] },
  { platform: "Android", aliases: ["android"] },
  { platform: "Linux", aliases: ["linux", "ubuntu"] }
] as const;

export type Platform = (typeof platformDefinitions)[number]["platform"];

export const platformOptions: Platform[] = platformDefinitions.map(
  ({ platform }) => platform
);

export const seniorityOptions = [
  "Associate",
  "Mid",
  "Senior",
  "Staff",
  "Lead",
  "Manager"
] as const;

export type Seniority = (typeof seniorityOptions)[number];

const nonLeadershipManagerTitleTerms = [
  "account",
  "policy",
  "product",
  "program",
  "project",
  "resource",
  "risk"
] as const;

const nonLeadershipManagerTitlePhrases = [
  "configuration manager",
  "microsoft endpoint manager"
] as const;

const executiveLeadershipTitleTerms = [
  "chief",
  "cio",
  "ciso",
  "cto",
  "director",
  "evp",
  "head",
  "svp",
  "vice president",
  "vp"
] as const;

export function isLeadershipTitle(title: string) {
  const normalizedTitle = normalizeTokens(title);

  if (executiveLeadershipTitleTerms.some((term) => hasTitleTerm(normalizedTitle, term))) {
    return true;
  }

  if (
    hasTitleTerm(normalizedTitle, "manager")
    && !nonLeadershipManagerTitleTerms.some((term) => hasTitleTerm(normalizedTitle, term))
    && !nonLeadershipManagerTitlePhrases.some((phrase) => normalizedTitle.includes(phrase))
  ) {
    return true;
  }

  return hasTitleTerm(normalizedTitle, "lead");
}

function hasTitleTerm(value: string, term: string) {
  return (` ${value} `).includes(` ${term} `);
}

export const roleFamilyOptions = [
  "Endpoint Engineering",
  "macOS Platform",
  "Windows Platform",
  "Workplace Systems",
  "Endpoint Security",
  "Device Compliance",
  "Systems Administration",
  "Automation"
] as const;

export type RoleFamily = (typeof roleFamilyOptions)[number];

export const systemsAdministrationRoleTerms = [
  "systems administrator",
  "system administrator",
  "systems administration",
  "sysadmin",
  "it administrator",
  "it systems administrator",
  "windows administrator",
  "systems engineer",
  "system engineer",
  "it systems engineer",
  "infrastructure engineer",
  "infrastructure administrator"
] as const;

export const endpointRoleTerms = [
  "endpoint",
  "endpoints",
  "end-point",
  "end-point protection",
  "desktop engineer",
  "desktop engineering",
  "desktop systems",
  "desktop administrator",
  "desktop infrastructure",
  "client platform",
  "client infrastructure",
  "client engineering",
  "client management",
  "client fleet",
  "macos client",
  "device management",
  "device engineer",
  "device fleet",
  "end user computer",
  "end user computing",
  "end user compute",
  "end user engineering",
  "end user technology",
  "end user services",
  "employee experience technology",
  "digital employee experience",
  "end-user computer",
  "end-user computing",
  "end-user compute",
  "end-user engineering",
  "digital workplace",
  "it client services",
  "studio it",
  "workplace engineer",
  "workplace systems",
  "modern management",
  "endpoint security",
  "device trust",
  "zero-touch",
  "zero touch",
  "tech operations engineer",
  "technology operations engineer",
  "mac admin",
  "mac administrator",
  "macos engineer",
  "windows engineer",
  "windows administrator",
  "mdm",
  "m365",
  "microsoft 365",
  "uem",
  "software packaging",
  "application packaging",
  "patch management",
  "workstation"
] as const;

const specialistTechnicalRoleTerms = [
  "spezialist",
  "endpoint administrator",
  "system development engineer",
  "systems development engineer",
  "systems development manager",
  "service engineer",
  "it engineer",
  "platform engineer",
  "client engineer",
  "client infrastructure engineer",
  "device engineer",
  "device trust engineer",
  "it security engineer",
  "endpoint security engineer",
  "enterprise support engineer",
  "mdm support engineer",
  "consulting engineer",
  "solutions engineer",
  "professional services engineer",
  "corporate engineering",
  "enterprise engineering",
  "tech operations engineer",
  "technology operations engineer"
] as const;

export const technicalRoleTitleTerms = [
  ...systemsAdministrationRoleTerms,
  ...specialistTechnicalRoleTerms
] as const;

export const endpointSecurityRoleTerms = [
  "endpoint security",
  "endpoint protection",
  "endpoint detection",
  "endpoint response",
  "endpoint threat",
  "edr",
  "xdr"
] as const;

export type RoleFamilyInferenceRule = {
  family: RoleFamily;
  match: "any" | "all";
  aliases?: readonly string[];
  tools?: readonly EndpointTool[];
  platforms?: readonly Platform[];
};

export const roleFamilyInferenceRules = [
  {
    family: "Endpoint Security",
    match: "any",
    aliases: endpointSecurityRoleTerms,
    tools: ["Tanium", "Defender"]
  },
  {
    family: "Systems Administration",
    match: "all",
    aliases: systemsAdministrationRoleTerms,
    tools: ["PowerShell"]
  },
  {
    family: "Device Compliance",
    match: "any",
    aliases: ["compliance", "audit"]
  },
  {
    family: "Automation",
    match: "any",
    aliases: ["automation", "powershell", "packaging", "remediation"]
  },
  {
    family: "Windows Platform",
    match: "any",
    tools: ["SCCM"],
    platforms: ["Windows"]
  },
  {
    family: "macOS Platform",
    match: "any",
    tools: ["Jamf", "Kandji"],
    platforms: ["macOS"]
  },
  {
    family: "Workplace Systems",
    match: "any",
    aliases: ["workplace"]
  }
] as const satisfies readonly RoleFamilyInferenceRule[];
