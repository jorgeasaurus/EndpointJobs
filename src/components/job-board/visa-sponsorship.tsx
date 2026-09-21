import { sponsorshipLabels } from "@/lib/visa-sponsorship";
import type { Job } from "@/types/job";

export function VisaSponsorship({
  sponsorship,
  expanded = false
}: {
  sponsorship: Job["visaSponsorship"];
  expanded?: boolean;
}) {
  if (!sponsorship || sponsorship.status === "not-stated") {
    return expanded ? (
      <p className="visa-sponsorship-unknown">Visa sponsorship: Not stated</p>
    ) : null;
  }

  const sourceUrl = getSourceUrl(sponsorship.sourceUrl);

  return (
    <details className="visa-sponsorship" open={expanded}>
      <summary>Visa sponsorship: {sponsorshipLabels[sponsorship.status]}</summary>
      <div className="visa-sponsorship-body">
        <p>Based on the listing. Confirm conditions with the employer.</p>
        <blockquote>{sponsorship.evidence}</blockquote>
        {sourceUrl ? (
          <a href={sourceUrl} rel="noopener noreferrer" target="_blank">
            Read original listing
          </a>
        ) : null}
      </div>
    </details>
  );
}

function getSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}
