import type { Workplace } from "../../../src/types/job";

export type LinkedInCuratedListing = {
  title: string;
  company: string;
  location: string;
  workplace: Workplace;
  postedAt: string;
  linkedInId: string;
  tags: readonly [string, string, ...string[]];
  requiredText?: readonly [string, ...string[]];
  family: string;
};

export const linkedinCuratedListings = [
  {
    title: "10418 - Sr. Workstation Engineer",
    company: "Hyundai AutoEver America",
    location: "Irvine, CA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4404262585",
    tags: ["Workstation", "Windows", "EUC"],
    requiredText: ["Sr. Workstation Engineer", "Hyundai AutoEver America"],
    family: "workstation engineering"
  },
  {
    title: "UEM Engineers",
    company: "Leidos",
    location: "Odenton, MD",
    workplace: "Hybrid",
    postedAt: "2026-08-29",
    linkedInId: "4442138849",
    tags: ["UEM", "Endpoint Management"],
    family: "UEM engineering"
  },
  {
    title: "Sr IT Engineer - Tanium Administrator",
    company: "Honeywell Aerospace",
    location: "Phoenix, AZ",
    workplace: "On-site",
    postedAt: "2026-08-30",
    linkedInId: "4433886927",
    tags: ["Tanium", "Endpoint Management"],
    requiredText: ["Tanium Administrator", "Honeywell Aerospace"],
    family: "Tanium administration"
  },
  {
    title: "Team Lead: Digital Workplace Engineer",
    company: "K&L Gates",
    location: "Chicago, IL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4429209297",
    tags: ["Digital Workplace", "EUC"],
    requiredText: ["Digital Workplace Engineer", "K&L Gates"],
    family: "digital workplace engineering"
  },
  {
    title: "Windows Device Engineering Lead",
    company: "Takeda",
    location: "Cambridge, MA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4439257350",
    tags: ["Windows", "Device Engineering", "EUC"],
    family: "Windows device engineering"
  },
  {
    title: "Endpoint Administrator",
    company: "Targa Resources",
    location: "Tulsa, OK",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4432692480",
    tags: ["Endpoint", "Windows", "EUC"],
    family: "endpoint administration"
  },
  {
    title: "Senior Windows MECM Engineer",
    company: "StratasCorp Technologies",
    location: "Pensacola, FL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4459700859",
    tags: ["MECM", "SCCM", "Windows"],
    family: "Windows MECM engineering"
  },
  {
    title: "System Administrator III - Windows/SCCM/MECM",
    company: "Hyundai AutoEver America",
    location: "Montgomery, AL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4391802222",
    tags: ["SCCM", "MECM", "Windows"],
    requiredText: ["Windows/SCCM/MECM", "Hyundai AutoEver America"],
    family: "Windows SCCM/MECM systems administration"
  },
  {
    title: "Endpoint Administrator",
    company: "Targa Resources",
    location: "Houston, TX",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4432904109",
    tags: ["Endpoint", "Windows", "EUC"],
    family: "endpoint administration"
  },
  {
    title: "Senior Apple Platform Engineer",
    company: "SAIC",
    location: "Quantico, VA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4460833211",
    tags: ["Apple", "macOS", "Platform"],
    family: "Apple platform engineering"
  },
  {
    title: "Systems Engineer – UEM",
    company: "TJDEED Technology",
    location: "Jordan, PA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4460855462",
    tags: ["UEM", "Endpoint Management"],
    requiredText: ["Systems Engineer", "TJDEED Technology"],
    family: "UEM systems engineering"
  },
  {
    title: "EUC Administrator",
    company: "Tata Consultancy Services",
    location: "Blue Bell, PA",
    workplace: "On-site",
    postedAt: "2026-08-30",
    linkedInId: "4441365414",
    tags: ["EUC", "End-User Computing"],
    family: "EUC administration"
  },
  {
    title: "Sr. Endpoint Security Engineer I (6701)",
    company: "MetroStar",
    location: "Washington, DC",
    workplace: "On-site",
    postedAt: "2026-08-30",
    linkedInId: "4458849110",
    tags: ["Endpoint Security", "Endpoint"],
    requiredText: ["Endpoint Security Engineer", "MetroStar"],
    family: "endpoint security engineering"
  },
  {
    title: "Systems Engineer III - Software Packager",
    company: "First Citizens Bank",
    location: "Raleigh, NC",
    workplace: "Remote",
    postedAt: "2026-08-29",
    linkedInId: "4450781468",
    tags: ["Software Packaging", "Windows"],
    requiredText: ["Software Packager", "First Citizens Bank"],
    family: "software packaging"
  },
  {
    title: "Microsoft Identity & Devices Security Architect",
    company: "Cyclotron, Inc.",
    location: "Chicago, IL",
    workplace: "Remote",
    postedAt: "2026-08-29",
    linkedInId: "4441327900",
    tags: ["Microsoft Identity", "Devices", "Endpoint Security"],
    family: "Microsoft identity and devices security"
  },
  {
    title: "Endpoint Security Solutions (ESS) Engineer",
    company: "StratasCorp Technologies",
    location: "Pensacola, FL",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4459492941",
    tags: ["Endpoint Security", "ESS"],
    requiredText: ["Endpoint Security Solutions", "StratasCorp Technologies"],
    family: "endpoint security solutions engineering"
  },
  {
    title: "User Computing Administrator I",
    company: "CNA Corporation",
    location: "Arlington, VA",
    workplace: "On-site",
    postedAt: "2026-08-29",
    linkedInId: "4450358905",
    tags: ["EUC", "User Computing"],
    requiredText: ["User Computing Administrator", "CNA Corporation"],
    family: "user computing administration"
  }
] as const satisfies readonly LinkedInCuratedListing[];
