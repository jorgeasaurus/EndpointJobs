import { normalizeTokens } from "@/lib/text";
import type { Job } from "@/types/job";

export const metroAreaOptions = [
  "Atlanta, GA",
  "Austin, TX",
  "Baltimore, MD",
  "Barcelona, Spain",
  "Berlin, Germany",
  "Boston, MA",
  "Charlotte, NC",
  "Chicago, IL",
  "Columbus, OH",
  "Dallas, TX",
  "Denver, CO",
  "Detroit, MI",
  "Frankfurt, Germany",
  "Houston, TX",
  "Indianapolis, IN",
  "Jersey City, NJ",
  "Kansas City, MO",
  "London, UK",
  "Los Angeles, CA",
  "Madrid, Spain",
  "Maryland",
  "Miami, FL",
  "Milan, Italy",
  "Milwaukee, WI",
  "Munich, Germany",
  "Nashville, TN",
  "New York, NY",
  "Northern Virginia",
  "Paris, France",
  "Philadelphia, PA",
  "Phoenix, AZ",
  "Portland, OR",
  "Raleigh-Durham, NC",
  "San Diego, CA",
  "San Francisco, CA",
  "San Jose, CA",
  "Seattle, WA",
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
  "Frankfurt, Germany": ["frankfurt", "frankfurt am main"],
  "London, UK": ["london", "england united kingdom"],
  "Madrid, Spain": ["madrid"],
  "Milan, Italy": ["milan", "milano"],
  "Munich, Germany": ["munich", "munchen", "muenchen", "münchen"],
  "Paris, France": ["paris", "ile de france", "hauts de seine"],
  "Zurich, Switzerland": ["zurich", "fehraltorf", "uitikon", "dietikon", "horgen"]
};

type TokenAliasMatcher<T extends string> = {
  matches: (job: Job, value: T) => boolean;
};

export function createTokenAliasMatcher<T extends string>(
  options: readonly T[],
  keywordSets: Record<T, readonly string[]>,
  buildHaystack: (job: Job) => string
): TokenAliasMatcher<T> {
  // Precompute value → keywords once; matches() runs per job × selected
  // option during filtering, so lookups stay O(1).
  const matchers = new Map(
    options.map((value) => [
      value,
      keywordSets[value].map((key) => normalizeTokens(key))
    ])
  );

  return {
    matches(job, value) {
      const keywords = matchers.get(value);
      if (!keywords) return false;

      const haystack = ` ${normalizeTokens(buildHaystack(job))} `;
      return keywords.some((keyword) => keyword && haystack.includes(` ${keyword} `));
    }
  };
}

function buildLocationHaystack(job: Job) {
  return `${job.location} ${job.mapLocation?.label ?? ""} ${job.workplace}`;
}

export const metroAreaMatcher = createTokenAliasMatcher(
  metroAreaOptions,
  metroAreaKeywordSets,
  buildLocationHaystack
);
