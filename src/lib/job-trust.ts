import { getCurrencySymbol } from "@/lib/currency";
import { isActiveJob } from "@/lib/jobs";
import { foldTokens } from "@/lib/text";
import { getJobWorkplace } from "@/lib/workplace";
import type { Job, JobsFeed, Workplace } from "@/types/job";

const directSources = new Set([
  "Amazon Jobs",
  "Ashby",
  "Greenhouse",
  "Lever",
  "Oracle HCM",
  "Recruitee",
  "SmartRecruiters",
  "USAJOBS",
  "Workday"
]);

const locationCurrencies: Array<[RegExp, string]> = [
  [/\b(spain|españa|espana|comunidad de madrid|cataluña|cataluna|catalunya|andaluc[ií]a|pa[ií]s vasco|galicia|comunidad valenciana|madrid|barcelona)\b/i, "EUR"],
  [/\b(france|ile-de-france|île-de-france|deutschland|germany|italia|italy|nederland|netherlands|belgium|belgique|belgië|austria|österreich|osterreich|portugal|ireland|éire)\b/i, "EUR"],
  [/\bprovincia di\b/i, "EUR"],
  [/\b(united kingdom|england|scotland|wales|great britain)\b/i, "GBP"],
  [/(?:^|,|\s)(?:uk|gb)(?:$|,|\s)/i, "GBP"],
  [/\b(switzerland|schweiz|suisse|svizzera)\b/i, "CHF"],
  [/\bcanada\b/i, "CAD"],
  [/\baustralia\b/i, "AUD"],
  [/\bnew zealand\b/i, "NZD"],
  [/\bindia\b/i, "INR"],
  [/\bsingapore\b/i, "SGD"],
  [/\b(mexico|méxico)\b/i, "MXN"],
  [/\b(brazil|brasil)\b/i, "BRL"],
  [/\b(poland|polska)\b/i, "PLN"],
  [/\b(sweden|sverige)\b/i, "SEK"],
  [/\b(japan|日本)\b/i, "JPY"],
  [/\b(ontario|quebec|québec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island)\b/i, "CAD"],
  [/,\s*(?:es|fr|it|nl|pt|ie|at|be)\b/i, "EUR"],
  [/,\s*(?:gb|uk)\b/i, "GBP"],
  [/,\s*ch\b/i, "CHF"],
  [/,\s*au\b/i, "AUD"],
  [/,\s*mx\b/i, "MXN"],
  [/,\s*br\b/i, "BRL"],
  [/,\s*pl\b/i, "PLN"],
  [/,\s*sg\b/i, "SGD"],
  [/,\s*nz\b/i, "NZD"],
  [/,\s*jp\b/i, "JPY"]
];

const languageRules: Array<{ label: string; pattern: RegExp; weight: number }> = [
  { label: "Spanish", weight: 2, pattern: /\b(años|buscamos|conocimientos|experiencia|habilidades|ingenier[oa]s?|jornada|ofrecemos|requisitos|administrador|especialista|plataformas|seguridad|funciones|incorporación|contrato)\b/i },
  { label: "Spanish", weight: 3, pattern: /[¿¡ñ]|\/a\b|\(h\/x\/m\)/i },
  { label: "French", weight: 2, pattern: /\b(affaires|chargé|compétences|conformité|contrat|entreprise|expérience|ingénieur|poste|recherchons)\b/i },
  { label: "French", weight: 3, pattern: /\(h\/f\)|[œ]/i },
  { label: "German", weight: 2, pattern: /\b(berufserfahrung|erfahrung|kenntnisse|stellenangebot)\b/i },
  { label: "German", weight: 3, pattern: /ß/ },
  { label: "Italian", weight: 2, pattern: /\b(cerchiamo|contratto|esperienza|ingegnere|lavoro|requisiti)\b/i },
  { label: "Portuguese", weight: 2, pattern: /\b(conhecimentos|contratação|engenheiro|experiência|vaga)\b/i },
  { label: "Dutch", weight: 2, pattern: /\b(ervaring|functie|vacature|werkzaamheden)\b/i }
];

export function listingLanguage(job: Pick<Job, "title" | "summary" | "description">) {
  const text = `${job.title}\n${job.description ?? ""}`;
  const scores = new Map<string, number>();

  for (const rule of languageRules) {
    const matches = text.match(new RegExp(rule.pattern, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`));
    if (!matches) continue;
    scores.set(rule.label, (scores.get(rule.label) ?? 0) + matches.length * rule.weight);
  }

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  const best = ranked[0];
  if (!best || best[1] < 2) return undefined;
  return best[0];
}

export function prepareBoardFeed(feed: JobsFeed): JobsFeed {
  return {
    ...feed,
    jobs: feed.jobs.filter((job) => isActiveJob(job)).map(withPresentedSalary)
  };
}

export function dedupeJobs(jobs: readonly Job[]) {
  const winners = new Map<string, Job>();

  for (const job of jobs) {
    const key = duplicateKey(job);
    const current = winners.get(key);
    if (!current || preferDuplicate(job, current)) winners.set(key, job);
  }

  return jobs.filter((job) => winners.get(duplicateKey(job)) === job);
}

export function dedupeWorkplaceJobs(
  jobs: readonly Job[],
  workplace: "Any" | Exclude<Workplace, "Unknown">
) {
  const scoped = workplace === "Any"
    ? jobs
    : jobs.filter((job) => getJobWorkplace(job) === workplace);
  return dedupeJobs(scoped);
}

export function dedupedWorkplaceCounts(jobs: readonly Job[]) {
  return {
    Any: dedupeWorkplaceJobs(jobs, "Any").length,
    Remote: dedupeWorkplaceJobs(jobs, "Remote").length,
    Hybrid: dedupeWorkplaceJobs(jobs, "Hybrid").length,
    "On-site": dedupeWorkplaceJobs(jobs, "On-site").length
  };
}

export function inferLocationCurrency(location: string) {
  for (const [pattern, currency] of locationCurrencies) {
    if (pattern.test(location)) return currency;
  }
  return undefined;
}

const explicitCurrencyMarker = /(?:US\$|A\$|C\$|NZ\$|S\$|[€£]|\b(?:AUD|CAD|CHF|EUR|GBP|INR|JPY|MXN|NZD|SGD|USD)\b)/i;

export function presentSalary(job: Pick<Job, "location" | "salary">) {
  const salary = job.salary;
  if (!salary || !shouldInferLocationCurrency(salary)) return salary;
  const currency = inferLocationCurrency(job.location);
  if (!currency || currency === salary.currency) return salary;

  const symbol = getCurrencySymbol(currency);
  const label = salary.min || salary.max
    ? formatSalaryRange(symbol, salary.min, salary.max)
    : salary.label.replaceAll("$", symbol);

  return { ...salary, currency, currencySource: "default" as const, label };
}

export function withPresentedSalary<T extends Pick<Job, "location" | "salary">>(job: T): T {
  const salary = presentSalary(job);
  if (!salary || salary === job.salary) return job;
  return { ...job, salary };
}

function duplicateKey(job: Job) {
  return `${foldTokens(job.company)}|${foldTokens(job.title)}`;
}

function shouldInferLocationCurrency(salary: NonNullable<Job["salary"]>) {
  if (salary.currency !== "USD") return false;
  if (salary.currencySource === "source") return false;
  if (salary.currencySource === "default") return true;
  return !explicitCurrencyMarker.test(salary.label);
}

function preferDuplicate(candidate: Job, current: Job) {
  const candidateScore = duplicateScore(candidate);
  const currentScore = duplicateScore(current);
  if (candidateScore !== currentScore) return candidateScore > currentScore;
  return candidate.id < current.id;
}

function duplicateScore(job: Job) {
  let score = 0;
  if (job.postedAt !== job.fetchedAt) score += 4;
  if (job.description) score += 2;
  if (job.salary) score += 1;
  if (directSources.has(job.source)) score += 2;
  score += Math.min(job.description?.length ?? 0, 4000) / 4000;
  return score;
}

function formatSalaryAmount(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return value.toString();
}

function formatSalaryRange(symbol: string, min?: number, max?: number) {
  if (min && max) return `${symbol}${formatSalaryAmount(min)}-${symbol}${formatSalaryAmount(max)}`;
  return `${symbol}${formatSalaryAmount(min ?? max ?? 0)}`;
}
