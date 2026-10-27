import { getCurrencySymbol } from "@/lib/currency";
import { isActiveJob } from "@/lib/jobs";
import { hasUsLocationContext } from "@/lib/location-context";
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

// Patterns run on foldTokens() output: lowercase, diacritics folded, punctuation
// turned into spaces. UK regions are listed before EUR so "Northern Ireland"
// cannot match the Ireland rule. Mexico and England use lookbehinds so a
// leading "New " cannot be read as the country or as England, and "wales"
// ignores a leading "New South ". Country codes
// match a comma-separated segment or the final token, so a hyphen inside
// "Champagne-au-Mont-d'Or" is not read as Australia.
const locationCurrencies: Array<[RegExp, string]> = [
  [/\b(?:united kingdom|great britain|northern ireland|(?<!new )england|scotland|(?<!new south )wales)\b/, "GBP"],
  [/\b(?:spain|espana|comunidad de madrid|cataluna|catalunya|andalucia|pais vasco|galicia|comunidad valenciana|madrid|barcelona)\b/, "EUR"],
  [/\b(?:france|ile de france|deutschland|germany|italia|italy|nederland|netherlands|belgium|belgique|belgie|austria|osterreich|portugal|(?<!northern )ireland|eire)\b/, "EUR"],
  [/\bprovincia di\b/, "EUR"],
  [/\b(?:switzerland|schweiz|suisse|svizzera)\b/, "CHF"],
  [/\bcanada\b/, "CAD"],
  [/\b(?:australia|new south wales)\b/, "AUD"],
  [/\bnew zealand\b/, "NZD"],
  [/\bindia\b/, "INR"],
  [/\bsingapore\b/, "SGD"],
  [/(?<!new )\bmexico\b/, "MXN"],
  [/\b(?:brazil|brasil)\b/, "BRL"],
  [/\b(?:poland|polska)\b/, "PLN"],
  [/\b(?:sweden|sverige)\b/, "SEK"],
  [/(?:^| )(?:japan|日本)(?: |$)/, "JPY"],
  [/\b(?:ontario|quebec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island)\b/, "CAD"]
];

const countryCodeCurrencies = new Map<string, string>([
  ["gb", "GBP"],
  ["uk", "GBP"],
  ["at", "EUR"],
  ["be", "EUR"],
  ["es", "EUR"],
  ["fr", "EUR"],
  ["ie", "EUR"],
  ["it", "EUR"],
  ["nl", "EUR"],
  ["pt", "EUR"],
  ["ch", "CHF"],
  ["au", "AUD"],
  ["mx", "MXN"],
  ["br", "BRL"],
  ["pl", "PLN"],
  ["sg", "SGD"],
  ["nz", "NZD"],
  ["jp", "JPY"]
]);

const languageRules: Array<{ label: string; pattern: RegExp; weight: number }> = [
  { label: "Spanish", weight: 2, pattern: /\b(años|buscamos|conocimientos|experiencia|habilidades|ingenier[oa]s?|jornada|ofrecemos|requisitos|administrador|especialista|plataformas|seguridad|funciones|incorporación|contrato)\b/i },
  { label: "Spanish", weight: 3, pattern: /[¿¡]|\b\w+o\/a\b|\(h\/x\/m\)/i },
  { label: "Spanish", weight: 1, pattern: /ñ/i },
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

export function prepareBoardFeed(feed: JobsFeed, now = new Date()): JobsFeed {
  return {
    ...feed,
    jobs: feed.jobs.filter((job) => isActiveJob(job, now)).map(withPresentedSalary)
  };
}

export function dedupeJobs(jobs: readonly Job[]) {
  const parent = jobs.map((_, index) => index);
  const find = (index: number) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== root) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[leftRoot] = rightRoot;
  };

  const roleOwners = new Map<string, number>();
  const postingOwners = new Map<string, number>();
  jobs.forEach((job, index) => {
    const role = duplicateKey(job);
    const roleOwner = roleOwners.get(role);
    if (roleOwner === undefined) roleOwners.set(role, index);
    else union(roleOwner, index);

    const posting = postingKey(job);
    if (!posting) return;
    const postingOwner = postingOwners.get(posting);
    if (postingOwner === undefined) postingOwners.set(posting, index);
    else union(postingOwner, index);
  });

  const winnerAt = new Map<number, number>();
  jobs.forEach((job, index) => {
    const root = find(index);
    const currentIndex = winnerAt.get(root);
    if (currentIndex === undefined || preferDuplicate(job, jobs[currentIndex])) winnerAt.set(root, index);
  });

  const winners = new Set(winnerAt.values());
  return jobs.filter((_, index) => winners.has(index));
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
  const folded = foldTokens(location);
  if (!folded || hasUsLocationContext(folded)) return undefined;
  for (const [pattern, currency] of locationCurrencies) {
    if (pattern.test(folded)) return currency;
  }
  const codes = locationCountryCodes(location);
  for (const [code, currency] of countryCodeCurrencies) {
    if (codes.has(code)) return currency;
  }
  return undefined;
}

function locationCountryCodes(location: string) {
  const codes = new Set<string>();
  for (const part of location.split(",")) {
    const folded = foldTokens(part);
    if (folded && !folded.includes(" ")) codes.add(folded);
  }
  const lastToken = foldTokens(location).split(" ").at(-1);
  if (lastToken) codes.add(lastToken);
  return codes;
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
  return [
    foldTokens(job.company),
    foldTokens(job.title),
    foldTokens(job.location),
    foldTokens(getJobWorkplace(job))
  ].join("|");
}

function postingKey(job: Job) {
  return (job.applyUrl && canonicalPostingUrl(job.applyUrl)) || canonicalPostingUrl(job.sourceUrl);
}

const trackingParamNames = new Set([
  "ref",
  "src",
  "source",
  "gclid",
  "fbclid",
  "dclid",
  "gclsrc",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_eid",
  "mc_cid",
  "yclid",
  "twclid",
  "ttclid",
  "igshid",
  "gad_source",
  "gad_campaignid",
  "_ga",
  "_gl",
  "trackingid",
  "refid"
]);

function isTrackingParam(key: string) {
  const name = key.toLowerCase();
  return name.startsWith("utm_") || trackingParamNames.has(name);
}

function compareQueryParams(left: [string, string], right: [string, string]) {
  if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
  if (left[1] === right[1]) return 0;
  return left[1] < right[1] ? -1 : 1;
}

export function canonicalPostingUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !isTrackingParam(key))
      .sort(compareQueryParams)
      .map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    const query = params.join("&");
    return `${url.host.toLowerCase()}${path}${query ? `?${query}` : ""}`;
  } catch {
    return undefined;
  }
}

function shouldInferLocationCurrency(salary: NonNullable<Job["salary"]>) {
  if (salary.currency !== "USD") return false;
  if (salary.currencySource === "source") return false;
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
