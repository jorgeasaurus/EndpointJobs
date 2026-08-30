const highVolumeJobCountryCodes = new Set(["us", "ch", "it", "es", "fr", "de"]);

export function isHighVolumeJobCountry(countryCode: string) {
  return highVolumeJobCountryCodes.has(countryCode.trim().toLowerCase());
}

export function partitionJobCountryCodes(countryCodes: string[]) {
  const primary: string[] = [];
  const secondary: string[] = [];

  for (const countryCode of countryCodes) {
    if (isHighVolumeJobCountry(countryCode)) {
      primary.push(countryCode);
    } else {
      secondary.push(countryCode);
    }
  }

  return [primary, secondary].filter((batch) => batch.length > 0);
}
