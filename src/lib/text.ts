/**
 * Shared text-normalization primitives.
 *
 * Two distinct strategies live here on purpose:
 * - `normalizeText` collapses whitespace only — preserves punctuation, symbols,
 *   and casing, used where the literal characters still matter (descriptions,
 *   case-sensitive prefix matching). Callers that need case-folding apply
 *   `toLowerCase()` explicitly at the call site.
 * - `normalizeTokens` strips to letters/marks/numbers and lowercases — used for
 *   fuzzy token matching where only the word shapes matter (filters, titles).
 * - `foldTokens` is `normalizeTokens` plus diacritic folding, so São Paulo and
 *   Sao Paulo match in free-text location search.
 * - `isNewMexicoUsLocation` is the shared New Mexico collision check for an
 *   already folded/normalized location string.
 */

export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTokens(value: string) {
  return value
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function foldTokens(value: string) {
  return normalizeTokens(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNewMexicoUsLocation(normalizedLocation: string) {
  if (` ${normalizedLocation} `.includes(" new mexico ")) {
    return true;
  }

  const locationWithoutCountry = normalizedLocation.replace(
    / (?:us|usa|united states(?: of america)?)$/,
    ""
  );
  const locationWithoutTrailingZip = locationWithoutCountry.replace(/ \d{5}(?: \d{4})?$/, "");
  return /(?:^| )nm$/.test(locationWithoutTrailingZip);
}
