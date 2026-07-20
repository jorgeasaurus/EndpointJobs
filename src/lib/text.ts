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
