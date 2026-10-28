const boilerplatePreview = /\b(?:listing|posting)\s+preview\b/i;
const boilerplateDescription = /\b(?:full|complete)\s+description\b/i;
const boilerplateDestination = /\b(?:source posting|original posting|employer(?:'s)? (?:site|listing|posting))\b/i;
const boilerplateAvailable = /\bdescription is available\b/i;

const sourceStopWords = new Set(["via", "the", "jobs", "job", "io", "com", "app"]);

export function isBoilerplateListingText(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length < 48 || !boilerplatePreview.test(text)) return false;
  if (boilerplateDescription.test(text) && boilerplateDestination.test(text)) return true;
  return boilerplateAvailable.test(text) && boilerplateDestination.test(text);
}

export function dedupeJobLead(summary: string, bodyText: string) {
  const collapsed = collapseRepeatedExcerpt(summary);
  if (!collapsed) return "";

  const body = bodyText.replace(/\s+/g, " ").trim().toLowerCase();
  if (!body) return collapsed;

  const kept = splitSentences(collapsed).filter((sentence) => {
    const probe = sentence.replace(/(?:\.{3}|…)\s*$/u, "").trim().toLowerCase();
    if (probe.length < 24) return true;
    return !body.includes(probe.slice(0, Math.min(probe.length, 96)));
  });

  return kept.join(" ").trim();
}

export function cardSourceLabels(source: string, attribution: string | undefined) {
  const detail = attribution?.trim() ?? "";
  if (!detail || sameSourceLabel(source, detail)) {
    return { badge: source, detail: undefined as string | undefined };
  }
  return { badge: undefined as string | undefined, detail };
}

function sameSourceLabel(source: string, attribution: string) {
  const left = sourceTokens(source);
  const right = sourceTokens(attribution);
  if (left.length === 0 || right.length === 0) {
    return source.trim().toLowerCase() === attribution.trim().toLowerCase();
  }
  if (left.length !== right.length) return false;
  return left.every((token) => right.includes(token));
}

function sourceTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !sourceStopWords.has(token));
}

function collapseRepeatedExcerpt(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const kept: string[] = [];

  for (const sentence of splitSentences(text)) {
    const key = sentence.replace(/(?:\.{3}|…)\s*$/u, "").trim().toLowerCase();
    const duplicate = kept.some((previous) => {
      const prior = previous.replace(/(?:\.{3}|…)\s*$/u, "").trim().toLowerCase();
      const limit = Math.min(48, key.length, prior.length);
      return limit >= 24 && (key.startsWith(prior.slice(0, limit)) || prior.startsWith(key.slice(0, limit)));
    });
    if (!duplicate) kept.push(sentence.trim());
  }

  return kept.join(" ").trim();
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}
