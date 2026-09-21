import { readFile, writeFile } from "node:fs/promises";
import { classifyVisaSponsorship } from "./job-refresh/visa-sponsorship";
import { enrichVisaSponsorshipWithJev } from "./job-refresh/jev-sponsorship";
import type { JobsFeed } from "../src/types/job";

const path = new URL("../src/data/jobs.json", import.meta.url);
const original = await readFile(path, "utf8");
const feed: JobsFeed = JSON.parse(original);
for (const job of feed.jobs) {
  const sponsorship = job.visaSponsorship ?? classifyVisaSponsorship(job.description ?? "", job.sourceUrl);
  // Missing metadata already means not stated; avoid rewriting every legacy record.
  if (sponsorship.status !== "not-stated") job.visaSponsorship = sponsorship;
}
const jevResult = await enrichVisaSponsorshipWithJev(feed.jobs);
feed.jobs = jevResult.jobs;
const counts: Record<string, number> = {};
for (const job of feed.jobs) {
  const status = job.visaSponsorship?.status ?? "not-stated";
  counts[status] = (counts[status] ?? 0) + 1;
}
const updated = JSON.stringify(feed, null, 2) + "\n";
if (original !== updated) await writeFile(path, updated);
console.log(JSON.stringify(counts, null, 2));
if (jevResult.attempted > 0 || jevResult.skipped > 0) {
  console.log(JSON.stringify({
    jevAttempted: jevResult.attempted,
    jevClassified: jevResult.classified,
    jevSkipped: jevResult.skipped,
    jevFailed: jevResult.failed
  }, null, 2));
}
