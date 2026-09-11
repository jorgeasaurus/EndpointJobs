// These guards accept normalized, lowercase location tokens.
function stripUsCountryAndZip(location: string) {
  return location
    .replace(/ (?:us|usa|united states(?: of america)?)$/, "")
    .replace(/ \d{5}(?: \d{4})?$/, "");
}

export function getUsStateSuffix(normalizedLocation: string) {
  return /(?:^| )(al|ak|az|ar|ca|co|ct|de|dc|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)$/.exec(
    stripUsCountryAndZip(normalizedLocation)
  )?.[1];
}

export function isAmbiguousPanamaCity(normalizedLocation: string) {
  return /\bpanama city\b/.test(normalizedLocation)
    && !/\b(?:panama city panama|ciudad de panama|republic of panama)\b/.test(normalizedLocation);
}

export function isNewMexicoUsLocation(normalizedLocation: string) {
  if (` ${normalizedLocation} `.includes(" new mexico ")) {
    return true;
  }

  return /(?:^| )nm$/.test(stripUsCountryAndZip(normalizedLocation));
}

export function isJamaicaUsNeighborhood(normalizedLocation: string) {
  const haystack = ` ${normalizedLocation} `;
  if (!haystack.includes(" jamaica ")) {
    return false;
  }

  return (
    haystack.includes(" queens ")
    || haystack.includes(" jamaica ny ")
    || haystack.includes(" jamaica new york ")
  ) && !haystack.includes(" kingston ") && !haystack.includes(" jm ");
}
