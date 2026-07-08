export type Platform = "macOS" | "Windows" | "iOS" | "Android" | "Linux";

export type EndpointTool =
  | "Jamf"
  | "Intune"
  | "SCCM"
  | "Fleet MDM"
  | "Kandji"
  | "NinjaOne"
  | "Workspace ONE"
  | "Tanium"
  | "Okta"
  | "Entra ID"
  | "Autopilot"
  | "PowerShell"
  | "Defender";

export type Workplace = "Remote" | "Hybrid" | "On-site" | "Unknown";

export type Seniority =
  | "Associate"
  | "Mid"
  | "Senior"
  | "Staff"
  | "Lead"
  | "Manager";

export type RoleFamily =
  | "Endpoint Engineering"
  | "macOS Platform"
  | "Windows Platform"
  | "Workplace Systems"
  | "Endpoint Security"
  | "Device Compliance"
  | "Automation";

export type TermsProfile =
  | "seed"
  | "attribution-required"
  | "partner-terms"
  | "public-api";

export type JobMapLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  mapLocation?: JobMapLocation;
  workplace: Workplace;
  postedAt: string;
  fetchedAt: string;
  staleAfter: string;
  expiresAt?: string;
  source: string;
  sourceUrl: string;
  applyUrl?: string;
  attributionLabel: string;
  termsProfile: TermsProfile;
  summary: string;
  description?: string;
  tags: string[];
  matchReasons: string[];
  tools: EndpointTool[];
  platforms: Platform[];
  roleFamily: RoleFamily;
  seniority: Seniority;
  employmentType: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    label: string;
  };
};

export type JobsFeed = {
  updatedAt: string;
  source: {
    name: string;
    url: string;
  };
  jobs: Job[];
};
