import type { Job } from "@/types/job";

export const platformChipFixtureId = "e2e-platform-chip-fixture";

const dayMs = 24 * 60 * 60 * 1000;

export function createPlatformChipFixture(now = new Date()): Job {
  const summary = "Fixture listing for Windows and macOS platform chips.";
  const description = [
    "Maintain endpoint configuration for this fixture listing, including enrollment, policy, and application delivery across the Windows and macOS fleets. This paragraph is long enough for the expanded description panel to render next to the platform chips.",
    "- Confirm Windows device compliance for the fixture fleet.",
    "- Confirm macOS device compliance for the fixture fleet."
  ].join("\n\n");

  return {
    id: platformChipFixtureId,
    title: "Platform chip alignment fixture",
    company: "Endpoint Jobs Fixture",
    location: "Seattle, WA",
    workplace: "Remote",
    postedAt: new Date(now.getTime() + 365 * dayMs).toISOString(),
    fetchedAt: now.toISOString(),
    staleAfter: new Date(now.getTime() + 90 * dayMs).toISOString(),
    source: "Greenhouse",
    sourceUrl: "https://example.com/e2e/platform-chip-fixture",
    applyUrl: "https://example.com/e2e/platform-chip-fixture/apply",
    attributionLabel: "Fixture listing",
    termsProfile: "public-api",
    summary,
    description,
    tags: ["Windows", "macOS"],
    matchReasons: ["Digital workplace", "Windows platform", "macOS platform"],
    tools: ["Intune"],
    platforms: ["Windows", "macOS", "Linux", "iOS", "Android"],
    roleFamily: "Endpoint Engineering",
    seniority: "Mid",
    employmentType: "Full-time"
  };
}

const productionPhases = new Set(["phase-production-build", "phase-production-server"]);

export function platformChipFixturesEnabled() {
  // Production renders keep NODE_ENV=production. `next build` also sets
  // NEXT_PHASE, so a development NODE_ENV during the build still cannot
  // bake this listing into the static site. Opt in with E2E_FIXTURES=1.
  if (process.env.NODE_ENV === "production") return false;
  if (productionPhases.has(process.env.NEXT_PHASE ?? "")) return false;
  return process.env.E2E_FIXTURES === "1";
}

export function seedPlatformChipFixture(jobs: readonly Job[], now = new Date()): Job[] {
  if (!platformChipFixturesEnabled() || jobs.some((job) => job.id === platformChipFixtureId)) {
    return [...jobs];
  }

  return [createPlatformChipFixture(now), ...jobs];
}
