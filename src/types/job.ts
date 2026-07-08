import type {
  EndpointTool,
  Platform,
  RoleFamily,
  Seniority
} from "../lib/job-taxonomy";

export type { EndpointTool, Platform, RoleFamily, Seniority };

export type Workplace = "Remote" | "Hybrid" | "On-site" | "Unknown";

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
