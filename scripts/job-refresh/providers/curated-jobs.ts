import type { Job, Workplace } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import { addDays, buildStableJobId, getJobStaleDays, normalizeSearchText, stripHtml, toEndpointJob } from "../shared";
import {
  linkedinCuratedListings,
  type LinkedInCuratedListing
} from "./curated-linkedin-jobs";

export type CuratedAvailabilityCheck = {
  requiredText: readonly [string, ...string[]];
  unavailableText?: readonly string[];
};

type CuratedJob = {
  title: string;
  company: string;
  location: string;
  workplace: Workplace;
  postedAt: string;
  expiresAt?: string;
  sourceUrl: string;
  availabilityUrl?: string;
  requireLiveAvailability?: boolean;
  description: string;
  employmentType: string;
  sourceTags: string[];
  availability: CuratedAvailabilityCheck;
  salary?: Job["salary"];
};

type AvailabilityResult =
  | { status: "available" }
  | { status: "unavailable"; reason: string }
  | { status: "unknown"; reason: string };

const curatedJobSourceName = "Curated Jobs";
const availabilityTimeoutMs = 10_000;
const unavailableStatusCodes = new Set([404, 410]);
const defaultUnavailableText = [
  "job is no longer available",
  "job no longer available",
  "position is no longer available",
  "this position has been filled",
  "this job has expired",
  "this job posting has expired",
  "no longer accepting applications"
];

const curatedJobs: [CuratedJob, ...CuratedJob[]] = [
  {
    title: "Software Packaging Engineer",
    company: "NinjaOne",
    location: "United States",
    workplace: "Remote",
    postedAt: "2026-07-12",
    sourceUrl: "https://jobs.jobvite.com/ninjaone/job/oKCZzfwE",
    employmentType: "Full-time",
    salary: {
      min: 120000,
      max: 150000,
      currency: "USD",
      label: "$120k-$150k"
    },
    sourceTags: ["Curated", "Software Packaging", "RMM", "SCCM", "Intune", "PowerShell"],
    availability: {
      requiredText: [
        "Software Packaging Engineer",
        "NinjaOne"
      ]
    },
    description: [
      "Build production-ready third-party software packages and endpoint automation for NinjaOne's automated patching platform.",
      "- Analyze MSI, EXE, and custom installers for silent installation, upgrade behavior, and OS compatibility.",
      "- Develop endpoint scripts that download, install, upgrade, and verify applications across Windows, macOS, and Linux.",
      "- Define packaging standards and respond to vulnerabilities, vendor changes, and automation failures.",
      "- Requires software packaging experience with RMM, SCCM, Intune, or similar endpoint management platforms and strong PowerShell skills.",
      "- Remote within supported US states; published compensation is $120,000-$150,000 for listed states."
    ].join("\n")
  },
  {
    title: "EUC Engineer – Endpoint Management (f/m/d)",
    company: "Greentube GmbH",
    location: "Vienna",
    workplace: "Hybrid",
    postedAt: "2026-06-05",
    sourceUrl: "https://careers.greentube.com/EUC-Engineer-Endpoint-Management-fmd-eng-j624.html",
    employmentType: "Full-time",
    salary: {
      min: 60000,
      currency: "EUR",
      label: "EUR 60k gross/year"
    },
    sourceTags: ["Curated", "Presence / Mobile", "Windows 365", "Zero Trust", "ServiceNow"],
    availability: {
      requiredText: [
        "EUC Engineer",
        "Greentube GmbH"
      ]
    },
    description: [
      "As an EUC Engineer - Endpoint Management, this role plays a key part in delivering a secure, scalable, and modern workplace experience across the business. Working closely with Infrastructure, Security, and Identity teams, this position drives innovation across endpoint management while helping shape the future of Greentube's Microsoft-based workplace environment.",
      "Your tasks",
      "- Design, implement, and continuously enhance endpoint management solutions using Microsoft Intune across Windows, macOS, iOS, and Android devices.",
      "- Lead and optimize Windows Autopilot onboarding processes to improve the device lifecycle experience from deployment through retirement.",
      "- Drive endpoint update and patch management strategies through Windows Autopatch and update ring configurations.",
      "- Support and further develop Windows 365 Cloud PC environments across physical and virtual endpoints.",
      "- Strengthen Zero Trust initiatives, including BitLocker, Conditional Access, compliance-driven access, Entra Private Access, Entra Internet Access, and Global Secure Access.",
      "- Operate within ITIL and change management frameworks using ServiceNow while maintaining technical documentation and operational runbooks.",
      "- Automate operational processes to reduce manual effort and improve endpoint estate efficiency.",
      "Your profile",
      "- Strong hands-on experience managing enterprise endpoint environments using Microsoft Intune and Windows Autopilot.",
      "- Solid understanding of Microsoft Entra ID and modern device management concepts within security-focused environments.",
      "- Experience supporting Windows, macOS, iOS, and Android devices at scale.",
      "- Strong troubleshooting skills for remote and physical device issues.",
      "- Experience with PowerShell, Microsoft Graph API, Ansible, or similar automation is an advantage.",
      "- Exposure to Microsoft Defender for Endpoint, Azure Virtual Desktop, Citrix DaaS, BeyondTrust EPM, Robopack, Nexthink, or relevant Microsoft certifications is a plus.",
      "Compensation",
      "- Published base salary is 60.000 EUR gross/year, paid in 14 salaries."
    ].join("\n")
  },
  {
    requireLiveAvailability: true,
    title: "Senior Desktop Engineer",
    company: "Ropes & Gray",
    location: "Boston, MA; New York, NY",
    workplace: "Hybrid",
    postedAt: "2026-08-07T04:00:00.000Z",
    expiresAt: "2027-08-07T04:00:00.000Z",
    sourceUrl: "https://careers-ropesgray.icims.com/jobs/9281/senior-desktop-engineer/job?in_iframe=1",
    employmentType: "Full-time",
    salary: { min: 134700, max: 222350, currency: "USD", label: "$134,700-$222,350/year; varies by location" },
    sourceTags: ["Curated", "Endpoint", "Intune", "Windows", "PowerShell"],
    availability: { requiredText: ["Senior Desktop Engineer", "Ropes & Gray", "Intune"] },
    description: "Manage enterprise desktop systems and the endpoint lifecycle, including enrollment, compliance, updates, and retirement. Configure Intune profiles, Group Policy, and security baselines; automate administration and reporting with PowerShell. Monitor device health and resolve complex desktop and application issues as a Tier 3 escalation resource. Hybrid in Boston or New York. Published salary ranges are $134,700-$205,450 in Boston and $145,800-$222,350 in New York."
  },
  {
    requireLiveAvailability: true,
    title: "Sr. Consultant, Professional Services (Microsoft Security)",
    company: "Softchoice",
    location: "Chicago, IL; Denver, CO; Florida; Texas",
    workplace: "Unknown",
    postedAt: "2026-09-19T02:00:00.000Z",
    sourceUrl: "https://careers.softchoice.com/job/Chicago-Sr_-Consultant%2C-Professional-Services-%28Microsoft-Security%29-IL-60290/603794317/",
    employmentType: "Full-time",
    salary: { min: 110960, max: 138700, currency: "USD", label: "$110,960-$138,700/year in Florida and Denver" },
    sourceTags: ["Curated", "Endpoint Security", "Microsoft Defender", "Identity"],
    availability: { requiredText: ["Sr. Consultant", "Softchoice", "workplace endpoint security"] },
    description: "Advise enterprise and public-sector clients on Microsoft identity and workplace endpoint security. Implement security configurations, migrations, and policies using Microsoft 365 Defender, Defender for Cloud, and Sentinel. Guide customers through technical decisions and mentor other consultants and engineers. Locations include Chicago, Denver, Florida, and Texas. The published Florida and Denver base range is $110,960-$138,700 with a 14% target incentive; other locations may differ."
  },
  {
    requireLiveAvailability: true,
    title: "Information Technology Programmer Analyst 12 (Endpoint & User Management)",
    company: "State of Michigan",
    location: "Dimondale, MI",
    workplace: "Hybrid",
    postedAt: "2026-10-06",
    expiresAt: "2026-10-21T03:59:00.000Z",
    sourceUrl: "https://www.governmentjobs.com/jobs/5506606-0/information-technology-programmer-analyst-12-endpoint-user-management",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Endpoint", "User Management", "Microsoft 365"],
    availability: { requiredText: ["Information Technology Programmer Analyst 12", "State of Michigan", "Endpoint"] },
    description: "Administer statewide enterprise infrastructure, including computer management platforms, account services, Microsoft 365, DNS, and virtualization. Monitor core services and provide third- and fourth-tier incident support for technology staff. Participate in infrastructure projects affecting state accounts and devices. Hybrid in Dimondale with two days on-site and three remote days per week; applicants must reside in Michigan or relocate. Permanent full-time, $34.45-$49.53 per hour. Applications close October 20, 2026 at 11:59 PM Eastern."
  },
  {
    requireLiveAvailability: true,
    title: "Partner 18, IT Engineer, San Francisco/Menlo Park",
    company: "Andreessen Horowitz",
    location: "San Francisco, CA; Menlo Park, CA",
    workplace: "Hybrid",
    postedAt: "2026-06-04T00:31:40.000Z",
    sourceUrl: "https://a16z.com/about/jobs/?gh_jid=7763203003",
    availabilityUrl: "https://boards-api.greenhouse.io/v1/boards/a16z/jobs/7763203003",
    employmentType: "Full-time",
    salary: { min: 189000, max: 221000, currency: "USD", label: "$189,000-$221,000/year" },
    sourceTags: ["Curated", "Endpoint", "Jamf", "Kandji", "Intune"],
    availability: { requiredText: ["Partner 18, IT Engineer", "Andreessen Horowitz", "Intune"] },
    description: "Build and operate the firm's IT infrastructure and SaaS platforms. Manage endpoint, identity, and access tooling with Jamf, Kandji, Okta, and Intune; lead systems projects and automation work. Serve as an escalation resource for complex incidents and executive technology needs. Requires client platform engineering experience. Work from the San Francisco or Menlo Park office four days per week, with occasional travel between offices. The published base salary range is $189,000-$221,000, with additional carry and discretionary bonus eligibility."
  },
  {
    requireLiveAvailability: true,
    title: "Director, IT",
    company: "Life360",
    location: "United States",
    workplace: "Remote",
    postedAt: "2026-07-16T16:34:29.000Z",
    sourceUrl: "https://job-boards.greenhouse.io/life360/jobs/8636922002",
    employmentType: "Full-time",
    salary: { min: 167000, max: 245000, currency: "USD", label: "$167,000-$245,000/year" },
    sourceTags: ["Curated", "Endpoint Management", "Jamf", "IT Leadership"],
    availability: { requiredText: ["Director, IT", "Life360", "endpoint management"] },
    description: "Lead IT operations and engineering for a distributed workforce, including enterprise identity, endpoint management, infrastructure, collaboration, and employee services. Set technical roadmaps, develop the team, and own service standards, vendor relationships, and budgets. Partner with Security on access controls and compliance while expanding automation. Requires 15 years of IT experience and seven to eight years of senior leadership. Remote within the United States; the published salary range is $167,000-$245,000 and varies by geographic tier."
  },
  {
    requireLiveAvailability: true,
    title: "Senior IT Support Engineer",
    company: "MrBeast",
    location: "Chicago, IL",
    workplace: "Hybrid",
    postedAt: "2026-06-02T16:49:00.000Z",
    sourceUrl: "https://job-boards.greenhouse.io/mrbeastyoutube/jobs/6011407004",
    employmentType: "Full-time",
    salary: { min: 91000, max: 114000, currency: "USD", label: "$91,000-$114,000 base/year; $100,000-$125,000 total" },
    sourceTags: ["Curated", "Endpoint", "macOS", "Windows", "FleetDM", "Munki", "Intune"],
    availability: { requiredText: ["Senior IT Support Engineer", "Beast Industries", "FleetDM"] },
    description: "Own identity and access operations and support Feastables' Chicago office. Administer Okta, Google Workspace, and SaaS integrations; lead endpoint rollouts, security deployments, and hardware refreshes. Manage Mac devices with FleetDM and Munki and support Windows endpoints and executive technology needs. Requires five years of IT experience and two years focused on identity. On-site four days per week with Fridays remote. Published base salary is $91,000-$114,000, with target total compensation of $100,000-$125,000."
  },
  ...linkedinCuratedListings.map(toLinkedInCuratedJob)
] satisfies [CuratedJob, ...CuratedJob[]];

function toLinkedInCuratedJob(listing: LinkedInCuratedListing): CuratedJob {
  return {
    title: listing.title,
    company: listing.company,
    location: listing.location,
    workplace: listing.workplace,
    postedAt: listing.postedAt,
    sourceUrl: `https://www.linkedin.com/jobs/view/${listing.linkedInId}`,
    employmentType: "Full-time",
    sourceTags: ["Curated", ...listing.tags],
    availability: {
      requiredText: listing.requiredText ?? [listing.title, listing.company]
    },
    description: [
      `${listing.workplace} ${listing.title} listing at ${listing.company} in ${listing.location}.`,
      `The title places this role in the ${listing.family} family.`,
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  };
}

export const curatedJobProvider = {
  id: "curated",
  displayName: curatedJobSourceName,
  defaultUrl: curatedJobs[0].sourceUrl,
  reserveFeedSlots: true,
  fetchJobs: ({ fetchedAt }) => fetchCuratedJobs(fetchedAt)
} as const satisfies ProviderAdapter<"curated">;

async function fetchCuratedJobs(fetchedAt: Date) {
  const availabilityResults = await Promise.all(
    curatedJobs.map(async (job) => ({
      job,
      availability: await checkCuratedJobAvailability(job)
    }))
  );

  return availabilityResults.map(({ job, availability }) => {
    if (availability.status === "unavailable") {
      console.warn(`Skipping curated job ${job.title}: ${availability.reason}`);
      return null;
    }

    if (availability.status === "unknown" && job.requireLiveAvailability) {
      console.warn(`Skipping curated job ${job.title}: ${availability.reason}`);
      return null;
    }

    if (availability.status === "unknown") {
      console.warn(`Keeping curated job ${job.title}: ${availability.reason}`);
    }

    return normalizeCuratedJob(job, fetchedAt, availability.status === "available");
  });
}

async function checkCuratedJobAvailability(job: CuratedJob): Promise<AvailabilityResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), availabilityTimeoutMs);

  try {
    const response = await fetch(job.availabilityUrl ?? job.sourceUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
        "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
      },
      signal: controller.signal
    });

    const statusResult = classifyCuratedHttpStatus(response.status, response.ok);
    if (statusResult) {
      return statusResult;
    }

    return evaluateCuratedAvailability(job.availability, await response.text());
  } catch (error) {
    return {
      status: "unknown",
      reason: `availability check failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function classifyCuratedHttpStatus(
  status: number,
  ok: boolean
): AvailabilityResult | undefined {
  if (unavailableStatusCodes.has(status)) {
    return { status: "unavailable", reason: `source returned ${status}` };
  }

  if (!ok) {
    return { status: "unknown", reason: `availability check returned ${status}` };
  }
}

export function evaluateCuratedAvailability(
  availability: CuratedAvailabilityCheck,
  body: string
): AvailabilityResult {
  const text = normalizeSearchText(stripHtml(body));
  const unavailableText = [...defaultUnavailableText, ...(availability.unavailableText ?? [])];
  const matchedUnavailableText = unavailableText.find((phrase) => text.includes(normalizeSearchText(phrase)));

  if (matchedUnavailableText) {
    return { status: "unavailable", reason: `source contained "${matchedUnavailableText}"` };
  }

  const missingRequiredText = availability.requiredText.find(
    (requiredText) => !text.includes(normalizeSearchText(requiredText))
  );

  if (missingRequiredText) {
    return { status: "unavailable", reason: `source no longer contains "${missingRequiredText}"` };
  }

  return { status: "available" };
}

function normalizeCuratedJob(job: CuratedJob, fetchedAt: Date, available: boolean): Job | null {
  const refreshFreshness = available && job.requireLiveAvailability;
  const staleAfter = job.expiresAt || refreshFreshness
    ? new Date(Math.min(
        addDays(refreshFreshness ? fetchedAt : new Date(job.postedAt), getJobStaleDays()).getTime(),
        job.expiresAt ? Date.parse(job.expiresAt) : Infinity
      )).toISOString()
    : undefined;
  const normalized = toEndpointJob({
    id: buildStableJobId("curated", job.company, job.title, job.sourceUrl),
    title: job.title,
    company: job.company,
    location: job.location,
    workplace: job.workplace,
    postedAt: job.postedAt,
    staleAfter,
    fetchedAt,
    source: curatedJobSourceName,
    sourceUrl: job.sourceUrl,
    applyUrl: job.sourceUrl,
    attributionLabel: job.company,
    termsProfile: "seed",
    description: job.description,
    salary: job.salary ? { ...job.salary, currencySource: "source" } : undefined,
    sourceTags: job.sourceTags,
    haystackParts: [job.description],
    employmentType: job.employmentType
  });
  return normalized && job.expiresAt
    ? { ...normalized, expiresAt: job.expiresAt }
    : normalized;
}
