import type { Job, Workplace } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import { buildStableJobId, normalizeSearchText, stripHtml, toEndpointJob } from "../shared";

type CuratedAvailabilityCheck = {
  requiredText: [string, ...string[]];
  unavailableText?: readonly string[];
};

type CuratedJob = {
  title: string;
  company: string;
  location: string;
  workplace: Workplace;
  postedAt: string;
  sourceUrl: string;
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

const curatedJobs = [
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
  }
] satisfies [CuratedJob, ...CuratedJob[]];

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

    if (availability.status === "unknown") {
      console.warn(`Keeping curated job ${job.title}: ${availability.reason}`);
    }

    return normalizeCuratedJob(job, fetchedAt);
  });
}

async function checkCuratedJobAvailability(job: CuratedJob): Promise<AvailabilityResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), availabilityTimeoutMs);

  try {
    const response = await fetch(job.sourceUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain,*/*",
        "user-agent": "EndpointJobs/1.0 (+https://github.com/)"
      },
      signal: controller.signal
    });

    if (unavailableStatusCodes.has(response.status)) {
      return { status: "unavailable", reason: `source returned ${response.status}` };
    }

    if (!response.ok) {
      return { status: "unknown", reason: `availability check returned ${response.status}` };
    }

    return getAvailabilityFromBody(job, await response.text());
  } catch (error) {
    return {
      status: "unknown",
      reason: `availability check failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getAvailabilityFromBody(job: CuratedJob, body: string): AvailabilityResult {
  const text = normalizeSearchText(stripHtml(body));
  const unavailableText = [...defaultUnavailableText, ...(job.availability.unavailableText ?? [])];
  const matchedUnavailableText = unavailableText.find((phrase) => text.includes(normalizeSearchText(phrase)));

  if (matchedUnavailableText) {
    return { status: "unavailable", reason: `source contained "${matchedUnavailableText}"` };
  }

  const missingRequiredText = job.availability.requiredText.find(
    (requiredText) => !text.includes(normalizeSearchText(requiredText))
  );

  if (missingRequiredText) {
    return { status: "unavailable", reason: `source no longer contains "${missingRequiredText}"` };
  }

  return { status: "available" };
}

function normalizeCuratedJob(job: CuratedJob, fetchedAt: Date): Job | null {
  return toEndpointJob({
    id: buildStableJobId("curated", job.company, job.title, job.sourceUrl),
    title: job.title,
    company: job.company,
    location: job.location,
    workplace: job.workplace,
    postedAt: job.postedAt,
    fetchedAt,
    source: curatedJobSourceName,
    sourceUrl: job.sourceUrl,
    applyUrl: job.sourceUrl,
    attributionLabel: job.company,
    termsProfile: "seed",
    description: job.description,
    salary: job.salary,
    sourceTags: job.sourceTags,
    haystackParts: [job.description],
    employmentType: job.employmentType
  });
}
