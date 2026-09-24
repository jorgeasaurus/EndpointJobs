import { setTimeout as delay } from "node:timers/promises";
import type { Job } from "../../src/types/job";
import { classifyProviderPayload, getProviderProbe, type ProviderProbe } from "./providers";
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

function verifyProviderResponse(probe: ProviderProbe, response: { observation: Observation; body: string }) {
  // Payload evidence cannot override transport, redirect, or truncation uncertainty.
  if (!["reachable", "dead"].includes(response.observation.outcome)) return;
  const classified = classifyProviderPayload(probe, response.observation.status ?? 0, response.body);
  response.observation.outcome = classified.status === "ok" ? "reachable" : classified.status;
  response.observation.reason = classified.reason;
}

export async function checkDestination(destination: Destination): Promise<ExternalResult> {
  const first = await request(destination.url);
  const observations = [first.observation];
  const probe = getProviderProbe(destination.url);
  let outcome = first.observation.outcome;
  if (probe) {
    const response = await request(probe.url);
    verifyProviderResponse(probe, response);
    observations.push(response.observation);
    // A live API does not repair a broken application URL; both must be reachable.
    outcome = first.observation.outcome === "reachable" ? response.observation.outcome : first.observation.outcome;
    // A recognized response from the original job-ID API independently proves removal,
    // even when the HTML redirects to a board. Its own redirect/transport guards still apply.
    if (response.observation.outcome === "dead") outcome = "dead";
  }
  if (outcome === "dead") {
    const candidate = observations.findLast((item) => item.outcome === "dead")!;
    await delay(500);
    const repeat = await request(candidate.url);
    if (probe && candidate.url === probe.url) {
      verifyProviderResponse(probe, repeat);
    }
    observations.push(repeat.observation);
    outcome = repeat.observation.outcome === "dead" ? "dead" : "unverified";
  }
  return { ...destination, outcome, observations };
}

export async function auditExternal(jobs: readonly Job[], navigationUrls: readonly string[] = []) {
  const destinations = collectDestinations(jobs);
  const known = new Set(destinations.map((entry) => entry.url));
  for (const raw of navigationUrls) {
    const url = normalizeLink(raw, raw) ?? raw;
    if (!known.has(url)) {
      destinations.push({ url, jobIds: [], sources: ["site-navigation"] });
      known.add(url);
    }
  }
  const groups = new Map<string, Destination[]>();
  for (const destination of destinations) {
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
