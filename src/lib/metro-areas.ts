import { foldTokens, normalizeTokens } from "@/lib/text";
import { getJobWorkplace } from "@/lib/workplace";
import type { Job } from "@/types/job";

export const metroAreaOptions = [
  "Asunción, Paraguay",
  "Atlanta, GA",
  "Austin, TX",
  "Baltimore, MD",
  "Barcelona, Spain",
  "Berlin, Germany",
  "Bogotá, Colombia",
  "Boston, MA",
  "Buenos Aires, Argentina",
  "Charlotte, NC",
  "Chicago, IL",
  "Columbus, OH",
  "Dallas, TX",
  "Denver, CO",
  "Detroit, MI",
  "Frankfurt, Germany",
  "Guadalajara, Mexico",
  "Guatemala City, Guatemala",
  "Guayaquil, Ecuador",
  "Houston, TX",
  "Indianapolis, IN",
  "Jersey City, NJ",
  "Kansas City, MO",
  "Kingston, Jamaica",
  "La Paz, Bolivia",
  "Lima, Peru",
  "London, UK",
  "Los Angeles, CA",
  "Madrid, Spain",
  "Managua, Nicaragua",
  "Maryland",
  "Medellín, Colombia",
  "Mexico City, Mexico",
  "Miami, FL",
  "Milan, Italy",
  "Milwaukee, WI",
  "Monterrey, Mexico",
  "Montevideo, Uruguay",
  "Munich, Germany",
  "Nashville, TN",
  "New York, NY",
  "Northern Virginia",
  "Panama City, Panama",
  "Paris, France",
  "Philadelphia, PA",
  "Phoenix, AZ",
  "Portland, OR",
  "Quito, Ecuador",
  "Raleigh-Durham, NC",
  "Rio de Janeiro, Brazil",
  "San Diego, CA",
  "San Francisco, CA",
  "San Jose, CA",
  "San José, Costa Rica",
  "San Juan, Puerto Rico",
  "San Salvador, El Salvador",
  "Santa Cruz, Bolivia",
  "Santo Domingo, Dominican Republic",
  "Santiago, Chile",
  "São Paulo, Brazil",
  "Seattle, WA",
  "Tegucigalpa, Honduras",
  "Washington, DC",
  "Zurich, Switzerland"
] as const;

export type MetroAreaFilter = (typeof metroAreaOptions)[number];

const metroAreaValueSet: ReadonlySet<string> = new Set(metroAreaOptions);

export function isMetroAreaFilter(value: string): value is MetroAreaFilter {
  return metroAreaValueSet.has(value);
}

const metroAreaKeywordSets: Record<MetroAreaFilter, readonly string[]> = {
  "Atlanta, GA": ["atlanta", "georgia us"],
  "Austin, TX": ["austin", "bastrop tx", "bastrop bastrop", "tarrytown travis"],
  "Baltimore, MD": ["baltimore", "cockeysville"],
  "Boston, MA": ["boston", "east boston", "watertown ma"],
  "Charlotte, NC": ["charlotte", "davidson mecklenburg"],
  "Chicago, IL": ["chicago", "oak brook", "schiller park", "bartlett dupage", "morton grove", "illinois us"],
  "Columbus, OH": ["columbus", "grandview heights", "marysville union county", "ohio united states"],
  "Dallas, TX": ["dallas", "plano", "highland park dallas", "irving dallas"],
  "Denver, CO": ["denver", "westminster", "fort collins", "jacks cabin gunnison"],
  "Detroit, MI": ["detroit"],
  "Houston, TX": ["houston", "texas city", "galveston county"],
  "Indianapolis, IN": ["indianapolis", "zionsville boone"],
  "Jersey City, NJ": ["jersey city", "five corners", "paramus", "princeton", "berkeley heights", "union county", "new jersey us", "morristown morris"],
  "Kansas City, MO": ["kansas city", "overland park", "saint martins", "missouri us"],
  "Los Angeles, CA": ["los angeles", "culver city", "beverly hills", "huntington orange county", "hawthorne ca", "hawthorne los angeles", "pico heights", "textile finance", "claremont los angeles", "el segundo"],
  Maryland: ["annapolis junction", "odenton", "usa md", "anne arundel", "savage", "bethesda", "rockville md"],
  "Miami, FL": ["miami"],
  "Milwaukee, WI": ["milwaukee", "saint francis milwaukee", "butler waukesha"],
  "Nashville, TN": ["nashville"],
  "New York, NY": ["nyc", "new york", "new york city", "grand central", "manhattan", "brooklyn", "flatbush"],
  "Northern Virginia": ["northern virginia", "fairfax county", "springfield", "vienna", "sterling", "fort belvoir", "stafford county", "brooke stafford", "alexandria city", "chantilly fairfax", "rosslyn arlington", "clifton fairfax", "arlington"],
  "Philadelphia, PA": ["philadelphia", "elkins park", "william penn annex", "southeastern chester"],
  "Phoenix, AZ": ["phoenix", "tempe maricopa"],
  "Portland, OR": ["portland"],
  "Raleigh-Durham, NC": ["raleigh", "durham", "morrisville wake"],
  "San Diego, CA": ["san diego"],
  "San Francisco, CA": ["san francisco"],
  "San Jose, CA": ["san jose", "campbell", "santa clara county", "sunnyvale"],
  "Seattle, WA": ["seattle", "bellevue", "redmond", "king county", "greater seattle area"],
  "Washington, DC": ["washington d c", "washington dc", "usa dc washington", "mount rainier", "triangle prince william"],
  "Barcelona, Spain": ["barcelona"],
  "Berlin, Germany": ["berlin"],
  "Bogotá, Colombia": ["bogota", "bogotá", "bogota dc", "bogotá dc", "bogota colombia", "bogotá colombia"],
  "Buenos Aires, Argentina": ["buenos aires argentina", "caba", "capital federal"],
  "Frankfurt, Germany": ["frankfurt", "frankfurt am main"],
  "Guadalajara, Mexico": ["guadalajara"],
  "Guatemala City, Guatemala": ["guatemala city", "ciudad de guatemala"],
  "Guayaquil, Ecuador": ["guayaquil", "guayaquil ecuador"],
  "Kingston, Jamaica": ["kingston jamaica", "kingston jm"],
  "La Paz, Bolivia": ["la paz bolivia", "la paz bo", "nuestra senora de la paz"],
  "Lima, Peru": ["lima peru", "lima perú", "lima pe"],
  "London, UK": ["london", "england united kingdom"],
  "Madrid, Spain": ["madrid"],
  "Managua, Nicaragua": ["managua"],
  "Medellín, Colombia": ["medellin", "medellín"],
  "Mexico City, Mexico": [
    "mexico city",
    "cdmx",
    "ciudad de mexico",
    "ciudad de méxico",
    "mexico df"
  ],
  "Milan, Italy": ["milan", "milano"],
  "Monterrey, Mexico": ["monterrey"],
  "Montevideo, Uruguay": ["montevideo", "montevideo uruguay"],
  "Munich, Germany": ["munich", "munchen", "muenchen", "münchen"],
  "Panama City, Panama": ["panama city panama", "ciudad de panama", "ciudad de panamá"],
  "Quito, Ecuador": ["quito", "quito ecuador"],
  "Paris, France": ["paris", "ile de france", "île de france", "hauts de seine"],
  "Rio de Janeiro, Brazil": ["rio de janeiro"],
  "San José, Costa Rica": ["san jose costa rica", "san josé costa rica", "san jose cr"],
  "San Juan, Puerto Rico": ["san juan puerto rico", "san juan pr"],
  "San Salvador, El Salvador": ["san salvador"],
  "Santa Cruz, Bolivia": ["santa cruz bolivia", "santa cruz de la sierra", "santa cruz bo"],
  "Santo Domingo, Dominican Republic": [
    "santo domingo dominican republic",
    "santo domingo do",
    "santo domingo dr",
    "santo domingo"
  ],
  "Santiago, Chile": ["santiago chile", "santiago de chile"],
  "São Paulo, Brazil": ["sao paulo", "são paulo"],
  "Asunción, Paraguay": ["asuncion", "asunción", "asuncion paraguay"],
  "Tegucigalpa, Honduras": ["tegucigalpa"],
  "Zurich, Switzerland": ["zurich", "zürich", "fehraltorf", "uitikon", "dietikon", "horgen"]
};

const metroAreaExcludeKeywordSets: Partial<Record<MetroAreaFilter, readonly string[]>> = {
  "San Jose, CA": ["costa rica", "san jose cr"],
  "Santo Domingo, Dominican Republic": ["santo domingo pueblo"]
};

type TokenAliasMatcher<T extends string> = {
  matches: (job: Job, value: T) => boolean;
};

export function createTokenAliasMatcher<T extends string>(
  options: readonly T[],
  keywordSets: Record<T, readonly string[]>,
  buildHaystack: (job: Job) => string,
  excludeKeywordSets: Partial<Record<T, readonly string[]>> = {}
): TokenAliasMatcher<T> {
  // Precompute value → keywords once; matches() runs per job × selected
  // option during filtering, so lookups stay O(1).
  const matchers = new Map(
    options.map((value) => [
      value,
      keywordSets[value].map((key) => foldTokens(key))
    ])
  );
  const excludeMatchers = new Map(
    options.map((value) => [
      value,
      (excludeKeywordSets[value] ?? []).map((key) => foldTokens(key))
    ])
  );

  return {
    matches(job, value) {
      const keywords = matchers.get(value);
      if (!keywords) return false;

      const haystack = ` ${foldTokens(buildHaystack(job))} `;
      const excludes = excludeMatchers.get(value) ?? [];
      if (excludes.some((keyword) => keyword && haystack.includes(` ${keyword} `))) {
        return false;
      }
      return keywords.some((keyword) => keyword && haystack.includes(` ${keyword} `));
    }
  };
}

function buildLocationHaystack(job: Job) {
  return `${job.location} ${job.mapLocation?.label ?? ""} ${getJobWorkplace(job)}`;
}

const tokenAliasMatcher = createTokenAliasMatcher(
  metroAreaOptions,
  metroAreaKeywordSets,
  buildLocationHaystack,
  metroAreaExcludeKeywordSets
);

export const metroAreaMatcher = {
  matches(job: Job, value: MetroAreaFilter) {
    if (value === "San Jose, CA" && hasAccentedSanJoseWithoutCaliforniaContext(job)) {
      return false;
    }

    return tokenAliasMatcher.matches(job, value);
  }
};

function hasAccentedSanJoseWithoutCaliforniaContext(job: Job) {
  const unfoldedHaystack = ` ${normalizeTokens(buildLocationHaystack(job))} `;
  if (!unfoldedHaystack.includes(" san josé ")) {
    return false;
  }

  const foldedHaystack = ` ${foldTokens(buildLocationHaystack(job))} `;
  return !foldedHaystack.includes(" ca ") && !foldedHaystack.includes(" california ");
}
