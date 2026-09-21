export const sponsorshipStatuses = ["available", "case-by-case", "unavailable", "not-stated"] as const;

export type SponsorshipStatus = (typeof sponsorshipStatuses)[number];
export type VisaSponsorship =
  | { status: "not-stated"; evidence?: never; sourceUrl?: never }
  | {
      status: Exclude<SponsorshipStatus, "not-stated">;
      evidence: string;
      sourceUrl: string;
    };

export const sponsorshipLabels: Record<SponsorshipStatus, string> = {
  available: "Available",
  "case-by-case": "Case-by-case",
  unavailable: "Unavailable",
  "not-stated": "Not stated"
};
