const locationRequestUrl = `https://github.com/jorgeasaurus/EndpointJobs/issues/new?${new URLSearchParams({
  title: "Request coverage for a missing city or region",
  body: [
    "### City or region",
    "",
    "### State or province",
    "",
    "### Country",
    "",
    "### Additional context (optional)",
    "Tell us about the endpoint roles you are looking for.",
    "",
    "### Relevant job sources (optional)",
    "Add links to local job boards or employer career pages."
  ].join("\n")
})}`;

export function LocationRequestLink() {
  return (
    <a
      className="location-request-link"
      href={locationRequestUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Don’t see your city or region? Let us know on GitHub (opens in a new tab)"
    >
      Don’t see your city or region? Let us know on GitHub.
    </a>
  );
}
