import type {
  EndpointTool,
  Job,
  Platform,
  RoleFamily,
  Seniority
} from "@/types/job";

export const platformOptions: Platform[] = [
  "macOS",
  "Windows",
  "iOS",
  "Android",
  "Linux"
];

export const toolOptions: EndpointTool[] = [
  "Jamf",
  "Intune",
  "SCCM",
  "Fleet MDM",
  "Kandji",
  "NinjaOne",
  "Workspace ONE",
  "Tanium",
  "Okta",
  "Entra ID",
  "Autopilot",
  "Defender"
];

export const seniorityOptions: Seniority[] = [
  "Associate",
  "Mid",
  "Senior",
  "Staff",
  "Lead",
  "Manager"
];

export const roleFamilyOptions: RoleFamily[] = [
  "Endpoint Engineering",
  "macOS Platform",
  "Windows Platform",
  "Workplace Systems",
  "Endpoint Security",
  "Device Compliance",
  "Automation"
];

export function formatPostedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fresh";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(date);
}

export function getPostedAgeDays(value: string, now = new Date()) {
  const posted = new Date(value);

  if (Number.isNaN(posted.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(
    0,
    Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function getFreshnessLabel(value: string) {
  const age = getPostedAgeDays(value);

  if (!Number.isFinite(age)) {
    return "Freshness unknown";
  }

  if (age === 0) {
    return "Posted today";
  }

  if (age === 1) {
    return "1 day old";
  }

  return `${age} days old`;
}

export function isStale(job: Job, now = new Date()) {
  const staleAfter = new Date(job.staleAfter);

  if (Number.isNaN(staleAfter.getTime())) {
    return false;
  }

  return staleAfter.getTime() < now.getTime();
}

export function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Pending refresh";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function getSearchText(job: Job) {
  return [
    job.title,
    job.company,
    job.location,
    job.summary,
    job.description ?? "",
    job.seniority,
    job.employmentType,
    job.tags.join(" "),
    job.tools.join(" "),
    job.platforms.join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

export function getSalarySortValue(job: Job) {
  return job.salary?.max ?? job.salary?.min ?? 0;
}
