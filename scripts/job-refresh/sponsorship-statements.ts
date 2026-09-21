import { classifySponsorshipStatement } from "./sponsorship-rules";

const listMarker = /(?:^|\n)[ \t]*(?:[-*•]|\d+[.)])[ \t]+/;
const sponsorshipMention = /\bsponsor(?:ship|s|ing)?\b/i;
const qualificationHeading = /^(?:required(?: qualifications)?|minimum qualifications|qualifications|requirements):?$/i;
const experienceItem = /^\d+\+?\s+years?\b/i;
const qualificationItem = /^(?:\d+\+?\s+years?\b|ability to\b|experience (?:with|in)\b)/i;

export function sponsorshipMatchText(text: string) {
  return text.replace(/\*\*|__/g, "").replace(/^#{1,6}\s+/, "");
}

/** Preserve soft wraps; split list entries only when their structure is explicit. */
export function sponsorshipStatementGroups(description: string) {
  const paragraphs: string[] = [];
  for (const paragraph of description.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n+/)) {
    const previous = paragraphs.at(-1);
    // Blank lines can separate parent/child list items, not just paragraphs.
    const continuesList = previous && listMarker.test(previous) &&
      (listMarker.test(paragraph) || /^[ \t]+\S/.test(paragraph));
    const qualifiesClaim = previous && sponsorshipMention.test(previous) && listMarker.test(paragraph);
    if (continuesList || qualifiesClaim) {
      paragraphs[paragraphs.length - 1] += `\n\n${paragraph}`;
    } else {
      paragraphs.push(paragraph);
    }
  }
  const groups: string[][] = [];
  let followsQualificationHeading = false;
  let hasAmbiguousSponsorship = false;

  for (const paragraph of paragraphs) {
    const lines = paragraph.trim().split("\n").map((line) => line.trim()).filter(Boolean);
    const isQualificationList = followsQualificationHeading &&
      lines.filter((line) => experienceItem.test(line)).length >= 2 &&
      lines.every((line) => qualificationItem.test(line) || classifySponsorshipStatement(sponsorshipMatchText(line)));
    const entries = listMarker.test(paragraph)
      ? flatListEntries(paragraph)
      : isQualificationList ? lines : [paragraph];

    if (!entries) {
      hasAmbiguousSponsorship ||= sponsorshipMention.test(paragraph);
      followsQualificationHeading = false;
      continue;
    }
    for (const entry of entries) {
      // Keep U.S./U.K. within a statement, including work-authorization requirements.
      const statements = entry.split(/(?<=[.!?;])(?<!\b[A-Z]\.)(?=\s|[A-Z])|(?<=\.)(?=\s+[A-Z][a-z])/)
        .map((text) => text.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (statements.length) groups.push(statements);
    }
    followsQualificationHeading = lines.length === 1 && qualificationHeading.test(sponsorshipMatchText(lines[0]));
  }
  return { groups, hasAmbiguousSponsorship };
}

function flatListEntries(paragraph: string): string[] | undefined {
  const markers = [...paragraph.matchAll(/(?:^|\n)([ \t]*)(?:[-*•]|\d+[.)])[ \t]+/g)];
  const depths = new Set(markers.map((match) => match[1].replace(/\t/g, "    ").length));
  const entries = paragraph.split(listMarker);
  const rootDepth = Math.min(...depths);
  const hasIndentedContinuation = paragraph.split("\n").some((line) => {
    const indentation = line.match(/^[ \t]*/)?.[0].replace(/\t/g, "    ").length ?? 0;
    return line.trim().length > 0 && indentation > rootDepth;
  });
  // Nested lists and lists qualifying a preceding offer need hierarchical meaning.
  // Keep them unknown instead of detaching a restriction from its parent claim.
  const preamble = sponsorshipMatchText(entries[0].replace(/\s+/g, " ").trim());
  return depths.size > 1 || hasIndentedContinuation || sponsorshipMention.test(preamble) ? undefined : entries;
}
