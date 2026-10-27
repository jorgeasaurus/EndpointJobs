import { hasUsLocationContext } from "@/lib/location-context";
import { foldTokens } from "@/lib/text";

const countryNames = new Map<string, string>([
  ["united states", "United States"],
  ["united states of america", "United States"],
  ["usa", "United States"],
  ["us", "United States"],
  ["united kingdom", "United Kingdom"],
  ["great britain", "United Kingdom"],
  ["uk", "United Kingdom"],
  ["england", "United Kingdom"],
  ["scotland", "United Kingdom"],
  ["wales", "United Kingdom"],
  ["canada", "Canada"],
  ["germany", "Germany"],
  ["deutschland", "Germany"],
  ["france", "France"],
  ["spain", "Spain"],
  ["espana", "Spain"],
  ["italy", "Italy"],
  ["italia", "Italy"],
  ["netherlands", "Netherlands"],
  ["nederland", "Netherlands"],
  ["ireland", "Ireland"],
  ["australia", "Australia"],
  ["india", "India"],
  ["mexico", "Mexico"],
  ["switzerland", "Switzerland"],
  ["schweiz", "Switzerland"],
  ["japan", "Japan"],
  ["singapore", "Singapore"],
  ["new zealand", "New Zealand"],
  ["brazil", "Brazil"],
  ["brasil", "Brazil"],
  ["poland", "Poland"],
  ["sweden", "Sweden"],
  ["austria", "Austria"],
  ["belgium", "Belgium"],
  ["portugal", "Portugal"]
]);

export function formatRolePlace(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;

  const folded = foldTokens(location);
  if (!folded || folded === "remote") return undefined;

  const city = parts[0];
  const country = countryFor(parts, folded);
  if (foldTokens(city) === "remote") return country;
  if (country && foldTokens(city) !== foldTokens(country)) return `${city}, ${country}`;
  if (country) return country;
  if (parts.length > 1) return `${city}, ${parts[1]}`;
  return city;
}

function countryFor(parts: string[], foldedLocation: string) {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const named = countryNames.get(foldTokens(parts[index]));
    if (named) return named;
  }

  if (hasUsLocationContext(foldedLocation)) return "United States";
  if (parts.some((part) => /\b(?:county|parish)\b/i.test(part))) return "United States";
  return undefined;
}
