import type { Job, Workplace } from "../../../src/types/job";
import type { ProviderAdapter } from "../provider";
import { buildStableJobId, normalizeSearchText, stripHtml, toEndpointJob } from "../shared";

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
    title: "10418 - Sr. Workstation Engineer",
    company: "Hyundai AutoEver America",
    location: "Irvine, CA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4404262585",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Workstation", "Windows", "EUC"],
    availability: {
      requiredText: [
        "Sr. Workstation Engineer",
        "Hyundai AutoEver America"
      ]
    },
    description: [
      "On-site Senior Workstation Engineer listing at Hyundai AutoEver America in Irvine, CA.",
      "The title places this role in the workstation and Windows device-engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "UEM Engineers",
    company: "Leidos",
    location: "Odenton, MD",
    workplace: "Hybrid",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4442138849",
    employmentType: "Full-time",
    sourceTags: ["Curated", "UEM", "Endpoint Management"],
    availability: {
      requiredText: [
        "UEM Engineers",
        "Leidos"
      ]
    },
    description: [
      "Hybrid UEM Engineers listing at Leidos in Odenton, MD.",
      "The title places this role in the unified endpoint management (UEM) engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Sr IT Engineer - Tanium Administrator",
    company: "Honeywell Aerospace",
    location: "Phoenix, AZ",
    workplace: "On-site",
    postedAt: "2026-08-30",
    sourceUrl: "https://www.linkedin.com/jobs/view/4433886927",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Tanium", "Endpoint Management"],
    availability: {
      requiredText: [
        "Tanium Administrator",
        "Honeywell Aerospace"
      ]
    },
    description: [
      "On-site Senior IT Engineer — Tanium Administrator listing at Honeywell Aerospace in Phoenix, AZ.",
      "The title places this role in the Tanium / endpoint-administration family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Team Lead: Digital Workplace Engineer",
    company: "K&L Gates",
    location: "Chicago, IL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4429209297",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Digital Workplace", "EUC"],
    availability: {
      requiredText: [
        "Digital Workplace Engineer",
        "K&L Gates"
      ]
    },
    description: [
      "On-site Team Lead: Digital Workplace Engineer listing at K&L Gates in Chicago, IL.",
      "The title places this role in the digital workplace engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Windows Device Engineering Lead",
    company: "Takeda",
    location: "Cambridge, MA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4439257350",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Windows", "Device Engineering", "EUC"],
    availability: {
      requiredText: [
        "Windows Device Engineering Lead",
        "Takeda"
      ]
    },
    description: [
      "On-site Windows Device Engineering Lead listing at Takeda in Cambridge, MA.",
      "The title places this role in the Windows device-engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Endpoint Administrator",
    company: "Targa Resources",
    location: "Tulsa, OK",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4432692480",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Endpoint", "Windows", "EUC"],
    availability: {
      requiredText: [
        "Endpoint Administrator",
        "Targa Resources"
      ]
    },
    description: [
      "On-site Endpoint Administrator listing at Targa Resources in Tulsa, OK.",
      "The title places this role in the endpoint administration family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Senior Windows MECM Engineer",
    company: "StratasCorp Technologies",
    location: "Pensacola, FL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4459700859",
    employmentType: "Full-time",
    sourceTags: ["Curated", "MECM", "SCCM", "Windows"],
    availability: {
      requiredText: [
        "Senior Windows MECM Engineer",
        "StratasCorp Technologies"
      ]
    },
    description: [
      "On-site Senior Windows MECM Engineer listing at StratasCorp Technologies in Pensacola, FL.",
      "The title places this role in the Windows MECM/SCCM engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "System Administrator III - Windows/SCCM/MECM",
    company: "Hyundai AutoEver America",
    location: "Montgomery, AL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4391802222",
    employmentType: "Full-time",
    sourceTags: ["Curated", "SCCM", "MECM", "Windows"],
    availability: {
      requiredText: [
        "Windows/SCCM/MECM",
        "Hyundai AutoEver America"
      ]
    },
    description: [
      "On-site System Administrator III — Windows/SCCM/MECM listing at Hyundai AutoEver America in Montgomery, AL.",
      "The title places this role in the Windows SCCM/MECM systems-administration family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Endpoint Administrator",
    company: "Targa Resources",
    location: "Houston, TX",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4432904109",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Endpoint", "Windows", "EUC"],
    availability: {
      requiredText: [
        "Endpoint Administrator",
        "Targa Resources"
      ]
    },
    description: [
      "On-site Endpoint Administrator listing at Targa Resources in Houston, TX.",
      "The title places this role in the endpoint administration family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Senior Apple Platform Engineer",
    company: "SAIC",
    location: "Quantico, VA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4460833211",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Apple", "macOS", "Platform"],
    availability: {
      requiredText: [
        "Senior Apple Platform Engineer",
        "SAIC"
      ]
    },
    description: [
      "On-site Senior Apple Platform Engineer listing at SAIC in Quantico, VA.",
      "The title places this role in the Apple / macOS platform engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Systems Engineer – UEM",
    company: "TJDEED Technology",
    location: "Jordan, PA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4460855462",
    employmentType: "Full-time",
    sourceTags: ["Curated", "UEM", "Endpoint Management"],
    availability: {
      requiredText: [
        "Systems Engineer",
        "TJDEED Technology"
      ]
    },
    description: [
      "On-site Systems Engineer – UEM listing at TJDEED Technology in Jordan, PA.",
      "The title places this role in the unified endpoint management (UEM) systems-engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "EUC Administrator",
    company: "Tata Consultancy Services",
    location: "Blue Bell, PA",
    workplace: "On-site",
    postedAt: "2026-08-30",
    sourceUrl: "https://www.linkedin.com/jobs/view/4441365414",
    employmentType: "Full-time",
    sourceTags: ["Curated", "EUC", "End-User Computing"],
    availability: {
      requiredText: [
        "EUC Administrator",
        "Tata Consultancy Services"
      ]
    },
    description: [
      "On-site EUC Administrator listing at Tata Consultancy Services in Blue Bell, PA.",
      "The title places this role in the end-user computing (EUC) administration family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Sr. Endpoint Security Engineer I (6701)",
    company: "MetroStar",
    location: "Washington, DC",
    workplace: "On-site",
    postedAt: "2026-08-30",
    sourceUrl: "https://www.linkedin.com/jobs/view/4458849110",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Endpoint Security", "Endpoint"],
    availability: {
      requiredText: [
        "Endpoint Security Engineer",
        "MetroStar"
      ]
    },
    description: [
      "On-site Senior Endpoint Security Engineer I (6701) listing at MetroStar in Washington, DC.",
      "The title places this role in the endpoint security engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Systems Engineer III - Software Packager",
    company: "First Citizens Bank",
    location: "Raleigh, NC",
    workplace: "Remote",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4450781468",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Software Packaging", "Windows"],
    availability: {
      requiredText: [
        "Software Packager",
        "First Citizens Bank"
      ]
    },
    description: [
      "Remote Systems Engineer III — Software Packager listing at First Citizens Bank in Raleigh, NC.",
      "The title places this role in the software-packaging / Windows systems-engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Microsoft Identity & Devices Security Architect",
    company: "Cyclotron, Inc.",
    location: "Chicago, IL",
    workplace: "Remote",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4441327900",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Microsoft Identity", "Devices", "Endpoint Security"],
    availability: {
      requiredText: [
        "Microsoft Identity & Devices Security Architect",
        "Cyclotron, Inc."
      ]
    },
    description: [
      "Remote Microsoft Identity & Devices Security Architect listing at Cyclotron, Inc. in Chicago, IL.",
      "The title places this role in the Microsoft identity and devices security family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "Endpoint Security Solutions (ESS) Engineer",
    company: "StratasCorp Technologies",
    location: "Pensacola, FL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4459492941",
    employmentType: "Full-time",
    sourceTags: ["Curated", "Endpoint Security", "ESS"],
    availability: {
      requiredText: [
        "Endpoint Security Solutions",
        "StratasCorp Technologies"
      ]
    },
    description: [
      "On-site Endpoint Security Solutions (ESS) Engineer listing at StratasCorp Technologies in Pensacola, FL.",
      "The title places this role in the endpoint security solutions engineering family.",
      "Full-time. Source: the LinkedIn posting."
    ].join("\n")
  },
  {
    title: "User Computing Administrator I",
    company: "CNA Corporation",
    location: "Arlington, VA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    sourceUrl: "https://www.linkedin.com/jobs/view/4450358905",
    employmentType: "Full-time",
    sourceTags: ["Curated", "EUC", "User Computing"],
    availability: {
      requiredText: [
        "User Computing Administrator",
        "CNA Corporation"
      ]
    },
    description: [
      "On-site User Computing Administrator I listing at CNA Corporation in Arlington, VA.",
      "The title places this role in the user-computing / EUC administration family.",
      "Full-time. Source: the LinkedIn posting."
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
