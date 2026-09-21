import type { SponsorshipStatus } from "../../src/lib/visa-sponsorship";

type KnownStatus = Exclude<SponsorshipStatus, "not-stated">;
const subject = String.raw`(?:visa|immigration|H-1B|work (?:visa|permit)|employment(?: visa)?) sponsorship`;
const employer = String.raw`(?:we|the company|the employer|(?:the )?[\w&’'-]+)`;
const visas = String.raw`(?:(?:work|employment|immigration|H-1B) )?(?:visas|a visa)`;
const refusal = String.raw`(?:cannot|can't|can’t|do not(?: currently)?|does not(?: currently)?|will not|won't|won’t|(?:are |is )?(?:unable to|not able to))`;
const scope = String.raw`(?: for (?:this|the) (?:role|position|job|position offered))?`;
const timing = String.raw`(?:,? (?:at this time|now or in the future|either currently or in the future))?`;
const prefix = String.raw`(?:(?:please note(?: that)?[, :]+)?(?:at this time,? )?)`;
const offer = String.raw`(?:available|offered|provided|supported)`;
const positiveClaims = [
  `${subject} (?:is |will be )?${offer}`,
  `(?:we|the company|the employer) (?:can |will |do )?(?:offer|provide|support) ${subject}`,
  `we (?:can|will|do) sponsor ${visas}`
];
const condition = String.raw`(?:subject to approval|upon approval|for qualified candidates)`;

// Full assertions deliberately reject unknown trailing nouns and qualifications.
// Conditional claims precede positives so supported restrictions retain their meaning.
const rules: readonly { status: KnownStatus; patterns: readonly RegExp[] }[] = [
  {
    status: "case-by-case",
    patterns: [
      ...positiveClaims.map((claim) => `${claim}${scope} ${condition}`),
      `(?:limited )?${subject} (?:may|might|could) be (?:${offer}|considered)${scope}`,
      `(?:we|the company|the employer) (?:may|might|could|will consider|can consider) (?:offer |provide |offering |providing )?${subject}${scope}`,
      `${subject} (?:is )?(?:available |offered |provided )?(?:on a )?case[ -]by[ -]case(?: basis)?${scope}`,
      `${employer} will consider sponsoring a new qualified applicant for employment authorization for (?:this|the) (?:role|position|job)`,
      String.raw`(?:however, )?we (?:aren't|aren’t|are not) able to successfully sponsor visas for every role and every candidate`,
      String.raw`(?:but )?if we make you an offer, we will make every reasonable effort to get you a visa(?:, and we retain an immigration lawyer to help with this)?`
    ].map(completeAssertion)
  },
  {
    status: "available",
    patterns: [
      ...positiveClaims.map((claim) => `${claim}${scope}`),
      `${subject}: yes`
    ].map(completeAssertion)
  },
  {
    status: "unavailable",
    patterns: [
      `${subject}: no`,
      `no ${subject}(?: (?:is |will be )?${offer})?${scope}${timing}`,
      `${subject} (?:is |will be )?(?:not ${offer}|unavailable)${scope}${timing}`,
      `${employer} ${refusal} (?:offer|provide|support) ${subject}${scope}${timing}`,
      `${employer} ${refusal} sponsor (?:${visas}|(?:candidates|applicants) for work visas|work authorizations or visas)(?: or other immigration processes to attain or maintain employment eligibility)?${scope}${timing}`,
      `${employer} (?:is |are )?not (?:currently |now )?(?:or in (?:the )?foreseeable future )?sponsoring ${visas}${scope}${timing}`,
      `${employer} (?:is|are) not (?:offering|providing|supporting) ${subject}${scope}${timing}`,
      `(?:this|the) (?:role|position|job) is not eligible for ${subject}${timing}`,
      `${employer} will not consider candidates who require sponsorship for a work-authorized visa${timing}`,
      `${employer} ${refusal} provide sponsorship for employment visas(?: or participate in STEM OPT)?${scope}${timing}`,
      `${employer} does not have an employer work sponsorship program`,
      "eligible to work in the United States without company sponsorship",
      String.raw`(?:applicants|candidates) must not (?:now or in the future )?require (?:visa |work visa |employment |immigration )sponsorship${scope}${timing}`,
      String.raw`(?:applicants |candidates )?(?:must be |must already be |are required to be )(?:legally )?authori[sz]ed to (?:live and )?work(?: in (?:the )?[\w .]+)?[,]? without (?:requiring )?(?:visa |work visa |employment |immigration |employer )?sponsorship${timing}`
    ].map((claim) => completeAssertion(`(?:sponsorship )?${prefix}${claim}`))
  }
];

function completeAssertion(claim: string): RegExp {
  return new RegExp(`^(?:visa sponsorship: )?${claim}[.!]?$`, "i");
}

export function classifySponsorshipStatement(text: string): KnownStatus | undefined {
  return rules.find(({ patterns }) => patterns.some((pattern) => pattern.test(text)))?.status;
}
