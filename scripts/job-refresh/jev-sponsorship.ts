import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

import type { VisaSponsorship } from "../../src/lib/visa-sponsorship";
import type { Job } from "../../src/types/job";
import { getSponsorshipClassificationDescription } from "./shared";
import { analyzeVisaSponsorship } from "./visa-sponsorship";

const defaultModel = "jev-latest";
const defaultMinConfidence = 0.8;
const defaultConcurrency = 4;
const defaultMaxRequests = 50;
const defaultTimeoutMs = 8_000;
const defaultMaxRetries = 0;
const maxPassages = 24;
const maxPassageLength = 1_200;
const maxAdjacentContextLength = 256;
const sponsorshipSignal = /\b(?:sponsorship|visas?|immigration|work authori[sz]ation|employment authori[sz]ation|work permits?|H-?1B|OPT|CPT|sponsor(?:s|ed|ing)?\s+(?:visas?|candidates?|applicants?|employees?))\b/i;

type KnownStatus = Exclude<VisaSponsorship["status"], "not-stated">;
type JevChoiceResult = { choice: string; confidence: number; model: string };
type JevState = {
  job: { title: string; company: string };
  candidate_passages: Record<string, string>;
};
type JevInstructions = { task: string; rules: string[] };

export type JevChoiceEvaluator = (request: {
  state: JevState;
  instructions: JevInstructions;
  criteria: Record<string, Record<string, string> | string>;
  model: string;
}) => Promise<JevChoiceResult>;

export type JevSponsorshipResult = {
  sponsorship: VisaSponsorship;
  method: "deterministic" | "jev" | "not-stated";
  confidence?: number;
  model?: string;
  error?: string;
};

type JevOptions = {
  evaluator?: JevChoiceEvaluator | null;
  minConfidence?: number;
  model?: string;
};

export async function classifyVisaSponsorshipWithJev(
  input: { description: string; sourceUrl: string; title?: string; company?: string },
  options: JevOptions = {}
): Promise<JevSponsorshipResult> {
  const deterministic = analyzeVisaSponsorship(input.description, input.sourceUrl);
  if (deterministic.sponsorship.status !== "not-stated") {
    return { sponsorship: deterministic.sponsorship, method: "deterministic" };
  }
  if (!deterministic.jevEligible) return { sponsorship: deterministic.sponsorship, method: "not-stated" };

  const passages = extractJevSponsorshipPassages(input.description);
  const evaluator = options.evaluator === null ? undefined : options.evaluator ?? createDefaultEvaluator();
  if (!passages.length || !evaluator) {
    return { sponsorship: deterministic.sponsorship, method: "not-stated" };
  }

  const criteria = buildCriteria(passages);
  try {
    const result = await evaluator({
      state: {
        job: { title: input.title ?? "", company: input.company ?? "" },
        candidate_passages: Object.fromEntries(passages.map((passage, index) => [`p${index}`, passage]))
      },
      instructions: {
        task: "Choose the single option that best represents the employer's visa or work-authorization sponsorship policy for this job.",
        rules: [
          "Use only explicit employer policy in `candidate_passages`.",
          "A question asked of an applicant, accepted visa type, relocation benefit, or existing work authorization does not by itself mean sponsorship is offered.",
          "If statements conflict, are hypothetical, or do not clearly establish a policy, choose `not_stated`.",
          "Select a passage option only when that exact passage supports its attached status."
        ]
      },
      criteria,
      model: options.model ?? process.env.JOB_JEV_MODEL ?? defaultModel
    });
    const selected = parseChoice(result.choice, passages);
    const minConfidence = options.minConfidence ?? getMinConfidence();
    if (!selected || !Number.isFinite(result.confidence) || result.confidence < minConfidence) {
      return {
        sponsorship: deterministic.sponsorship,
        method: "not-stated",
        ...(Number.isFinite(result.confidence) ? { confidence: result.confidence } : {}),
        ...(result.model ? { model: result.model } : {})
      };
    }

    return {
      sponsorship: {
        status: selected.status,
        evidence: selected.evidence,
        sourceUrl: input.sourceUrl
      },
      method: "jev",
      confidence: result.confidence,
      model: result.model
    };
  } catch (error) {
    return {
      sponsorship: deterministic.sponsorship,
      method: "not-stated",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function enrichVisaSponsorshipWithJev(
  jobs: Job[],
  options: JevOptions & { concurrency?: number; maxRequests?: number } = {}
) {
  const output = [...jobs];
  const eligible: Array<{ job: Job; index: number }> = [];
  for (const [index, job] of jobs.entries()) {
    if ((job.visaSponsorship?.status ?? "not-stated") !== "not-stated") continue;
    const description = getSponsorshipClassificationDescription(job);
    const deterministic = analyzeVisaSponsorship(description, job.sourceUrl);
    if (deterministic.sponsorship.status !== "not-stated") {
      output[index] = { ...job, visaSponsorship: deterministic.sponsorship };
    } else if (deterministic.jevEligible && extractJevSponsorshipPassages(description).length > 0) {
      eligible.push({ job, index });
    }
  }

  const evaluator = options.evaluator === null ? undefined : options.evaluator ?? createDefaultEvaluator();
  if (!evaluator) {
    return { jobs: output, classified: 0, attempted: 0, skipped: 0, failed: 0 };
  }

  const maxRequests = getMaxRequests(options.maxRequests);
  const candidates = eligible.slice(0, maxRequests);
  const skipped = eligible.length - candidates.length;
  let cursor = 0;
  let classified = 0;
  let failed = 0;
  const workerCount = Math.min(getConcurrency(options.concurrency), candidates.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < candidates.length) {
      const current = candidates[cursor++];
      const description = getSponsorshipClassificationDescription(current.job);
      const result = await classifyVisaSponsorshipWithJev({
        description,
        sourceUrl: current.job.sourceUrl,
        title: current.job.title,
        company: current.job.company
      }, { ...options, evaluator });
      if (result.error) failed++;
      if (result.sponsorship.status !== "not-stated") {
        if (result.method === "jev") classified++;
        output[current.index] = { ...current.job, visaSponsorship: result.sponsorship };
      }
    }
  }));

  return { jobs: output, classified, attempted: candidates.length, skipped, failed };
}

export function extractJevSponsorshipPassages(description: string) {
  const passages: string[] = [];
  const seen = new Set<string>();
  const blocks = description.replace(/\r\n?/g, "\n").split(/\n\s*\n+/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const [blockIndex, normalized] of blocks.entries()) {
    if (!sponsorshipSignal.test(normalized)) continue;
    const precedingContext = boundedAdjacentContext(blocks[blockIndex - 1], "preceding");
    const followingContext = boundedAdjacentContext(blocks[blockIndex + 1], "following");
    const contexts = [precedingContext, followingContext].filter((context): context is string => Boolean(context));
    const fragmentLength = maxPassageLength - contexts.reduce((total, context) => total + context.length + 2, 0);
    const fragments = normalized.length <= fragmentLength ? [normalized] : signalWindows(normalized, fragmentLength);
    for (const fragment of fragments) {
      const passage = [precedingContext, fragment, followingContext].filter(Boolean).join("\n\n");
      if (passage.length > maxPassageLength) return [];
      if (!passage || seen.has(passage)) continue;
      seen.add(passage);
      passages.push(passage);
      if (passages.length > maxPassages) return [];
    }
  }
  return passages;
}

function signalWindows(block: string, windowLength = maxPassageLength) {
  const matches = block.matchAll(new RegExp(sponsorshipSignal.source, "gi"));
  const windows: Array<{ start: number; end: number }> = [];
  for (const match of matches) {
    const matchIndex = match.index;
    const context = Math.floor((windowLength - match[0].length) / 2);
    const start = Math.min(Math.max(0, matchIndex - context), block.length - windowLength);
    const window = { start, end: start + windowLength };
    if (!windows.some(({ start: existingStart, end }) => existingStart === window.start && end === window.end)) {
      windows.push(window);
    }
  }
  return windows.map(({ start, end }) => block.slice(start, end).trim());
}

function boundedAdjacentContext(block: string | undefined, side: "preceding" | "following") {
  if (!block || block.length <= maxAdjacentContextLength) return block;
  const slice = side === "preceding"
    ? block.slice(-maxAdjacentContextLength).replace(/^\S*\s+/, "")
    : block.slice(0, maxAdjacentContextLength).replace(/\s+\S*$/, "");
  return slice.trim();
}

function buildCriteria(passages: string[]) {
  const criteria: Record<string, Record<string, string> | string> = {
    not_stated: "No candidate passage clearly and consistently states the employer's sponsorship policy for this job."
  };
  const definitions: Record<KnownStatus, string> = {
    available: "The employer explicitly offers or will provide visa or employment sponsorship for this job without a stated candidate-specific limitation.",
    "case-by-case": "The employer may sponsor or will consider sponsorship depending on the candidate, role, approval, qualifications, or another stated condition.",
    unavailable: "The employer explicitly will not sponsor this job, or applicants must already have work authorization without employer sponsorship."
  };
  for (const [index] of passages.entries()) {
    for (const [status, definition] of Object.entries(definitions) as Array<[KnownStatus, string]>) {
      criteria[`${status}:${index}`] = {
        status: definition,
        evidence_reference: `\`candidate_passages.p${index}\``
      };
    }
  }
  return criteria;
}

function parseChoice(value: string, passages: string[]) {
  if (value === "not_stated") return undefined;
  const match = /^(available|case-by-case|unavailable):(\d+)$/.exec(value);
  if (!match) return undefined;
  const evidence = passages[Number(match[2])];
  return evidence ? { status: match[1] as KnownStatus, evidence } : undefined;
}

function createDefaultEvaluator(): JevChoiceEvaluator | undefined {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim() || process.env.TYPESAFE_AI_APIKEY?.trim();
  if (!apiKey) return undefined;
  const client = new TypeSafeClient({
    apiKey,
    timeout: getTimeoutMs(),
    retry: { maxRetries: getMaxRetries() }
  });
  return async ({ state, instructions, criteria, model }) => {
    const response = await client.systemOne({
      state,
      questions: { sponsorship: choice(instructions, criteria) },
      model
    });
    const answer = response.answers.sponsorship;
    return {
      choice: answer.choice,
      confidence: answer.confidence,
      model: response.model
    };
  };
}

function getMinConfidence() {
  const value = Number(process.env.JOB_JEV_MIN_CONFIDENCE ?? defaultMinConfidence);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : defaultMinConfidence;
}

function getConcurrency(value = Number(process.env.JOB_JEV_CONCURRENCY ?? defaultConcurrency)) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, 12) : defaultConcurrency;
}

function getMaxRequests(value = Number(process.env.JOB_JEV_MAX_REQUESTS ?? defaultMaxRequests)) {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, 500) : defaultMaxRequests;
}

function getTimeoutMs() {
  const value = Number(process.env.JOB_JEV_TIMEOUT_MS ?? defaultTimeoutMs);
  return Number.isInteger(value) && value >= 1_000 && value <= 30_000 ? value : defaultTimeoutMs;
}

function getMaxRetries() {
  const value = Number(process.env.JOB_JEV_MAX_RETRIES ?? defaultMaxRetries);
  return Number.isInteger(value) && value >= 0 && value <= 3 ? value : defaultMaxRetries;
}
