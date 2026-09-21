import type { SponsorshipStatus, VisaSponsorship } from "../../src/lib/visa-sponsorship";
import { classifySponsorshipStatement } from "./sponsorship-rules";
import { sponsorshipMatchText, sponsorshipStatementGroups } from "./sponsorship-statements";

type KnownStatus = Exclude<SponsorshipStatus, "not-stated">;
// These continuations refer back to an assertion. An unsupported continuation
// cannot be discarded while retaining an unconditional promise or refusal.
const qualifyingContinuation = /^(?:however\b|but\b|only\b|except\b|unless\b|subject to\b|(?:not|unavailable|ineligible) for\b|(?:eligibility|availability) (?:is |remains )?(?:limited|restricted|subject to|determined)\b|for (?:internal transfers?\b|(?:qualified|eligible|selected|certain|some|specific)\b|(?:candidates?|applicants?) (?:who|with|meeting)\b)|(?:this|that) (?:offer |statement |policy )?(?:does not|doesn't|doesn’t|is limited|applies only)\b)/i;
const eligibilityQuestion = /^Is (?:this |the )?(?:role|position|job) eligible for (?:visa|immigration) sponsorship\?$/i;

export function classifyVisaSponsorship(description: string, sourceUrl: string): VisaSponsorship {
  return analyzeVisaSponsorship(description, sourceUrl).sponsorship;
}

export function analyzeVisaSponsorship(description: string, sourceUrl: string): {
  sponsorship: VisaSponsorship;
  jevEligible: boolean;
} {
  const claims: Array<{ status: KnownStatus; evidence: string }> = [];
  const { groups, hasAmbiguousSponsorship } = sponsorshipStatementGroups(description);
  if (hasAmbiguousSponsorship) return unresolved(false);
  for (const [groupIndex, statements] of groups.entries()) {
    const matches: Array<{ status: KnownStatus; start: number; end: number }> = [];
    for (const [index, statement] of statements.entries()) {
      const text = sponsorshipMatchText(statement);
      const answer = sponsorshipMatchText(statements[index + 1] ?? "");
      if (eligibilityQuestion.test(text) && /^(?:Yes|No)[.!]?$/i.test(answer)) {
        matches.push({ status: /^Yes/i.test(answer) ? "available" : "unavailable", start: index, end: index + 1 });
      } else {
        const status = classifySponsorshipStatement(text);
        if (status) matches.push({ status, start: index, end: index });
      }
    }
    if (!matches.length) continue;
    for (const match of matches) {
      const following = sponsorshipMatchText(statements[match.end + 1] ?? groups[groupIndex + 1]?.[0] ?? "");
      if (isQualifyingSponsorshipContinuation(following)) {
        return unresolved(false);
      }
    }
    const statuses = new Set(matches.map(({ status }) => status));
    if (statuses.has("unavailable") && statuses.size > 1) return unresolved(false);
    // An explicit limitation qualifies an offer; it must travel with its evidence.
    const conditional = matches.find(({ status }) => status === "case-by-case");
    const selected = conditional ?? matches[0];
    const start = conditional ? matches[0].start : selected.start;
    const end = conditional ? matches[matches.length - 1].end : selected.end;
    claims.push({ status: selected.status, evidence: statements.slice(start, end + 1).join(" ") });
  }
  const statuses = new Set(claims.map(({ status }) => status));
  if (!claims.length) return unresolved(true);
  if (statuses.has("unavailable") && statuses.size > 1) return unresolved(false);
  const claim = claims.find(({ status }) => status === "case-by-case") ?? claims[0];
  return { sponsorship: { ...claim, sourceUrl }, jevEligible: false };
}

export function isQualifyingSponsorshipContinuation(text: string) {
  const normalized = sponsorshipMatchText(text.replace(/\s+/g, " ").trim());
  return qualifyingContinuation.test(normalized) && !classifySponsorshipStatement(normalized);
}

function unresolved(jevEligible: boolean) {
  return { sponsorship: { status: "not-stated" } as const, jevEligible };
}
