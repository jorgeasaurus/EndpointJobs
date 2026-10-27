const SEPARATORS = new Set([".", "/"]);

/**
 * GoTrue allow-list match: strip the fragment, then glob with separators "." and "/".
 * `*` does not cross those separators. `**` does, which is what covers `?next=`.
 */
export function redirectAllowListCovers(patterns: readonly string[], redirectUrl: string): boolean {
  const matchAgainst = redirectUrl.split("#", 1)[0] ?? "";
  return patterns.some((pattern) => globMatch(pattern, matchAgainst));
}

export function globMatch(pattern: string, text: string): boolean {
  return matchAt(pattern, 0, text, 0);
}

function matchAt(pattern: string, patternIndex: number, text: string, textIndex: number): boolean {
  while (patternIndex < pattern.length) {
    if (pattern.startsWith("**", patternIndex)) {
      const rest = patternIndex + 2;
      if (rest === pattern.length) return true;
      for (let next = textIndex; next <= text.length; next += 1) {
        if (matchAt(pattern, rest, text, next)) return true;
      }
      return false;
    }

    if (pattern[patternIndex] === "*") {
      const rest = patternIndex + 1;
      if (matchAt(pattern, rest, text, textIndex)) return true;
      while (textIndex < text.length && !SEPARATORS.has(text[textIndex] ?? "")) {
        textIndex += 1;
        if (matchAt(pattern, rest, text, textIndex)) return true;
      }
      return false;
    }

    if (pattern[patternIndex] === "?") {
      const current = text[textIndex];
      if (current === undefined || SEPARATORS.has(current)) return false;
      patternIndex += 1;
      textIndex += 1;
      continue;
    }

    if (pattern[patternIndex] === "\\") {
      const escaped = pattern[patternIndex + 1];
      if (escaped === undefined || text[textIndex] !== escaped) return false;
      patternIndex += 2;
      textIndex += 1;
      continue;
    }

    if (text[textIndex] !== pattern[patternIndex]) return false;
    patternIndex += 1;
    textIndex += 1;
  }

  return textIndex === text.length;
}
