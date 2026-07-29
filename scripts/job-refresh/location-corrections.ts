type LocationCorrection = {
  sourceUrl: string;
  location: string;
};

const verifiedLocationCorrections: LocationCorrection[] = [
  {
    sourceUrl: "https://talents.vaia.com/companies/lowes/technology-operations-engineer-37989628",
    location: "Mooresville, NC"
  }
];

export function correctVerifiedJobLocation(location: string, sourceUrl: string) {
  const sourceIdentity = getSourceIdentity(sourceUrl);
  const correction = verifiedLocationCorrections.find(
    (candidate) => getSourceIdentity(candidate.sourceUrl) === sourceIdentity
  );

  return correction?.location ?? location;
}

function getSourceIdentity(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value.trim().replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}
