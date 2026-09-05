const highVolumeJobCountryCodes = new Set(["us", "ch", "it", "fr", "de"]);

export function isHighVolumeJobCountry(countryCode: string) {
  return highVolumeJobCountryCodes.has(countryCode.trim().toLowerCase());
}

export function isSpainJobCountry(countryCode: string) {
  return countryCode.trim().toLowerCase() === "es";
}

export function partitionJobCountryCodes(countryCodes: string[]) {
  const primary: string[] = [];
  const spain: string[] = [];
  const secondary: string[] = [];

  for (const countryCode of countryCodes) {
    if (isSpainJobCountry(countryCode)) {
      spain.push(countryCode);
    } else if (isHighVolumeJobCountry(countryCode)) {
      primary.push(countryCode);
    } else {
      secondary.push(countryCode);
    }
  }

  return [primary, spain, secondary].filter((batch) => batch.length > 0);
}
