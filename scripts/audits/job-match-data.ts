import { getJobMatch } from "../../src/components/job-board/job-match";
import type { Job } from "../../src/types/job";

export function auditJobMatchData({
  assertEqual,
  makeJob
}: {
  assertEqual: (actual: unknown, expected: unknown, detail?: string) => void;
  makeJob: (overrides: Partial<Job>) => Job;
}) {
  const job = makeJob({
    location: "Zürich, Switzerland",
    mapLocation: { label: "Zurich, Switzerland", latitude: 47.37, longitude: 8.54 },
    platforms: ["macOS", "Windows"],
    tools: ["Jamf", "Okta"],
    salary: { min: 120000, max: 150000, currency: "USD", label: "$120k-$150k" },
    seniority: "Senior"
  });

  const match = getJobMatch(job, {
    platforms: ["macOS"],
    tools: ["Jamf"],
    location: "Switzerland",
    salaryFloor: 140000,
    seniority: "Senior"
  });

  assertEqual(match?.score, 100);
  assertEqual(match?.label, "Strong match");
  assertEqual(match?.reasons.length, 5);
  assertEqual(match?.reasons.every((reason) => reason.matched), true);
}
