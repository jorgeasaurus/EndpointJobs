import { setTimeout as delay } from "node:timers/promises";
import type { Job } from "../../src/types/job";
import { classifyProviderPayload, getProviderProbe } from "./providers";
import { mapBounded, normalizeLink, request, type Observation } from "./check";

type Destination = { url: string; jobIds: string[]; sources: string[] };
export type ExternalResult = Destination & { outcome: Observation["outcome"]; observations: Observation[] };

export function collectDestinations(jobs: readonly Job[]): Destination[] {
  const destinations = new Map<string, Destination>();
  for (const job of jobs) {
    for (const raw of new Set([job.sourceUrl, job.applyUrl].filter((url): url is string => Boolean(url)))) {
      const url = normalizeLink(raw, raw) ?? raw;
      const entry = destinations.get(url) ?? { url, jobIds: [], sources: [] };
      if (!entry.jobIds.includes(job.id)) entry.jobIds.push(job.id);
      if (!entry.sources.includes(job.source)) entry.sources.push(job.source);
      destinations.set(url, entry);
    }
  }
  return [...destinations.values()];
}

export async function checkDestination(destination: Destination): Promise<ExternalResult> {
  const first = await request(destination.url);
  const observations = [first.observation];
  const probe = getProviderProbe(destination.url);
  let outcome = first.observation.outcome;
  if (probe) {
    const response = await request(probe.url);
    const classified = classifyProviderPayload(probe, response.observation.status ?? 0, response.body);
    if (classified.status !== "unverified") {
      response.observation.outcome = classified.status === "ok" ? "reachable" : "dead";
      response.observation.reason = classified.reason;
    } else if (response.observation.outcome === "reachable" || response.observation.outcome === "dead") {
      response.observation.outcome = "unverified";
      response.observation.reason = classified.reason;
    }
    observations.push(response.observation);
    // A live API does not repair a broken application URL; both must be reachable.
    outcome = first.observation.outcome === "reachable" ? response.observation.outcome : first.observation.outcome;
    if (response.observation.outcome === "dead") outcome = "dead";
  }
  if (outcome === "dead") {
    const candidate = observations.findLast((item) => item.outcome === "dead")!;
    await delay(500);
    const repeat = await request(candidate.url);
    if (probe && candidate.url === probe.url) {
      const classified = classifyProviderPayload(probe, repeat.observation.status ?? 0, repeat.body);
      repeat.observation.outcome = classified.status === "dead" ? "dead" : "unverified";
      repeat.observation.reason = classified.reason;
    }
    observations.push(repeat.observation);
    outcome = repeat.observation.outcome === "dead" ? "dead" : "unverified";
  }
  return { ...destination, outcome, observations };
}

export async function auditExternal(jobs: readonly Job[]) {
  const groups = new Map<string, Destination[]>();
  for (const destination of collectDestinations(jobs)) {
    let host = "invalid";
    try { host = new URL(destination.url).host; } catch { /* reported by request */ }
    groups.set(host, [...(groups.get(host) ?? []), destination]);
  }
  let completed = 0;
  // One request chain per destination host and at most eight chains in flight.
  const results = await mapBounded([...groups.values()].sort((a, b) => b.length - a.length), 8, async (group) => {
    const entries: ExternalResult[] = [];
    for (const destination of group) {
      entries.push(await checkDestination(destination));
      completed++;
      if (completed % 100 === 0) console.log(`External: ${completed} destinations checked`);
      await delay(150);
    }
    return entries;
  });
  return results.flat().sort((a, b) => a.url.localeCompare(b.url));
}
