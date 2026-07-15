import type { JobMapLocation } from "@/types/job";

type Coordinate = JobMapLocation & {
  keys: string[];
};

const locationCoordinates: Coordinate[] = [
  {
    label: "Washington, DC",
    latitude: 38.9072,
    longitude: -77.0369,
    keys: [
      "washington d c",
      "washington dc",
      "usa dc washington",
      "mount rainier",
      "triangle prince william"
    ]
  },
  {
    label: "New York, NY",
    latitude: 40.7128,
    longitude: -74.006,
    keys: ["nyc", "new york city", "grand central", "manhattan", "brooklyn", "flatbush"]
  },
  {
    label: "San Francisco, CA",
    latitude: 37.7749,
    longitude: -122.4194,
    keys: ["san francisco"]
  },
  {
    label: "San Jose, CA",
    latitude: 37.3382,
    longitude: -121.8863,
    keys: ["san jose", "campbell", "santa clara county", "sunnyvale"]
  },
  {
    label: "Mountain View, CA",
    latitude: 37.3861,
    longitude: -122.0839,
    keys: ["mountain view"]
  },
  {
    label: "Los Angeles, CA",
    latitude: 34.0522,
    longitude: -118.2437,
    keys: [
      "los angeles",
      "culver city",
      "beverly hills",
      "huntington orange county",
      "hawthorne ca",
      "hawthorne los angeles",
      "pico heights",
      "textile finance",
      "claremont los angeles",
      "el segundo"
    ]
  },
  {
    label: "Costa Mesa, CA",
    latitude: 33.6411,
    longitude: -117.9187,
    keys: ["costa mesa", "stanton orange county"]
  },
  {
    label: "San Diego, CA",
    latitude: 32.7157,
    longitude: -117.1611,
    keys: ["san diego"]
  },
  {
    label: "Seattle, WA",
    latitude: 47.6062,
    longitude: -122.3321,
    keys: ["seattle", "bellevue", "king county", "greater seattle area"]
  },
  { label: "Portland, OR", latitude: 45.5152, longitude: -122.6784, keys: ["portland"] },
  {
    label: "Phoenix, AZ",
    latitude: 33.4484,
    longitude: -112.074,
    keys: ["phoenix", "tempe maricopa"]
  },
  {
    label: "Salt Lake City, UT",
    latitude: 40.7608,
    longitude: -111.891,
    keys: ["sandy salt lake"]
  },
  {
    label: "Denver, CO",
    latitude: 39.7392,
    longitude: -104.9903,
    keys: ["denver", "westminster", "fort collins", "jacks cabin gunnison"]
  },
  {
    label: "Dallas, TX",
    latitude: 32.7767,
    longitude: -96.797,
    keys: ["dallas", "plano", "highland park dallas", "irving dallas"]
  },
  {
    label: "Austin, TX",
    latitude: 30.2672,
    longitude: -97.7431,
    keys: ["austin", "bastrop tx", "bastrop bastrop", "tarrytown travis"]
  },
  {
    label: "Brownsville, TX",
    latitude: 25.9017,
    longitude: -97.4975,
    keys: ["brownsville", "starbase"]
  },
  {
    label: "Houston, TX",
    latitude: 29.7604,
    longitude: -95.3698,
    keys: ["houston", "texas city", "galveston county"]
  },
  {
    label: "Lafayette, LA",
    latitude: 30.2241,
    longitude: -92.0198,
    keys: ["lafayette parish"]
  },
  { label: "Tampa, FL", latitude: 27.9506, longitude: -82.4572, keys: ["tampa"] },
  { label: "Miami, FL", latitude: 25.7617, longitude: -80.1918, keys: ["miami"] },
  {
    label: "Huntsville, AL",
    latitude: 34.7304,
    longitude: -86.5861,
    keys: ["huntsville", "triana madison county"]
  },
  {
    label: "Birmingham, AL",
    latitude: 33.5186,
    longitude: -86.8104,
    keys: ["birmingham", "malvern geneva"]
  },
  {
    label: "Atlanta, GA",
    latitude: 33.749,
    longitude: -84.388,
    keys: ["atlanta", "georgia us"]
  },
  {
    label: "Charlotte, NC",
    latitude: 35.2271,
    longitude: -80.8431,
    keys: ["charlotte", "davidson mecklenburg"]
  },
  {
    label: "Raleigh-Durham, NC",
    latitude: 35.7796,
    longitude: -78.6382,
    keys: ["durham", "morrisville wake"]
  },
  { label: "Nashville, TN", latitude: 36.1627, longitude: -86.7816, keys: ["nashville"] },
  {
    label: "Memphis, TN",
    latitude: 35.1495,
    longitude: -90.049,
    keys: ["bartlett shelby"]
  },
  {
    label: "Chicago, IL",
    latitude: 41.8781,
    longitude: -87.6298,
    keys: [
      "chicago",
      "oak brook",
      "schiller park",
      "bartlett dupage",
      "morton grove",
      "illinois us"
    ]
  },
  { label: "Detroit, MI", latitude: 42.3314, longitude: -83.0458, keys: ["detroit"] },
  {
    label: "Columbus, OH",
    latitude: 39.9612,
    longitude: -82.9988,
    keys: ["columbus", "grandview heights", "marysville union county", "ohio united states"]
  },
  {
    label: "Indianapolis, IN",
    latitude: 39.7684,
    longitude: -86.1581,
    keys: ["indianapolis", "zionsville boone"]
  },
  {
    label: "Milwaukee, WI",
    latitude: 43.0389,
    longitude: -87.9065,
    keys: ["milwaukee", "saint francis milwaukee", "butler waukesha"]
  },
  {
    label: "Kansas City, MO",
    latitude: 39.0997,
    longitude: -94.5786,
    keys: ["kansas city", "overland park", "saint martins", "missouri us"]
  },
  {
    label: "Philadelphia, PA",
    latitude: 39.9526,
    longitude: -75.1652,
    keys: ["philadelphia", "elkins park", "william penn annex", "southeastern chester"]
  },
  { label: "Pittsburgh, PA", latitude: 40.4406, longitude: -79.9959, keys: ["pennsylvania us"] },
  { label: "Buffalo, NY", latitude: 42.8864, longitude: -78.8784, keys: ["cheektowaga", "erie county"] },
  {
    label: "Jersey City, NJ",
    latitude: 40.7178,
    longitude: -74.0431,
    keys: [
      "jersey city",
      "five corners",
      "paramus",
      "princeton",
      "berkeley heights",
      "union county",
      "new jersey us",
      "morristown morris"
    ]
  },
  {
    label: "Wilmington, DE",
    latitude: 39.7391,
    longitude: -75.5398,
    keys: ["newark new castle", "manor new castle"]
  },
  {
    label: "Boston, MA",
    latitude: 42.3601,
    longitude: -71.0589,
    keys: ["boston", "east boston", "watertown ma"]
  },
  {
    label: "Baltimore, MD",
    latitude: 39.2904,
    longitude: -76.6122,
    keys: ["baltimore", "cockeysville"]
  },
  {
    label: "Northern Virginia",
    latitude: 38.8462,
    longitude: -77.3064,
    keys: [
      "fairfax county",
      "springfield",
      "vienna",
      "sterling",
      "fort belvoir",
      "stafford county",
      "brooke stafford",
      "alexandria city",
      "chantilly fairfax",
      "rosslyn arlington",
      "clifton fairfax"
    ]
  },
  {
    label: "Maryland",
    latitude: 39.0458,
    longitude: -76.6413,
    keys: ["annapolis junction", "odenton", "usa md", "anne arundel", "savage", "bethesda", "rockville md"]
  },
  {
    label: "Alaska",
    latitude: 64.2008,
    longitude: -149.4937,
    keys: ["alaska us"]
  },
  {
    label: "United States",
    latitude: 39.8283,
    longitude: -98.5795,
    keys: [
      "remote teleworker us",
      "remote us",
      "united states remote",
      "location negotiable",
      "us remote",
      "united states",
      "usa"
    ]
  },
  { label: "Toronto, Canada", latitude: 43.6532, longitude: -79.3832, keys: ["toronto"] },
  { label: "Canada", latitude: 56.1304, longitude: -106.3468, keys: ["canada"] },
  { label: "Mexico City, Mexico", latitude: 19.4326, longitude: -99.1332, keys: ["mexico city"] },
  { label: "Medellin, Colombia", latitude: 6.2476, longitude: -75.5658, keys: ["medellin"] },
  { label: "London, UK", latitude: 51.5072, longitude: -0.1276, keys: ["london", "england united kingdom"] },
  { label: "Berlin, Germany", latitude: 52.52, longitude: 13.405, keys: ["berlin"] },
  { label: "Hamburg, Germany", latitude: 53.5511, longitude: 9.9937, keys: ["hamburg"] },
  { label: "Munich, Germany", latitude: 48.1351, longitude: 11.582, keys: ["munich", "munchen"] },
  { label: "Frankfurt, Germany", latitude: 50.1109, longitude: 8.6821, keys: ["frankfurt", "frankfurt am main"] },
  { label: "Cologne, Germany", latitude: 50.9375, longitude: 6.9603, keys: ["cologne", "koln"] },
  { label: "Stuttgart, Germany", latitude: 48.7758, longitude: 9.1829, keys: ["stuttgart"] },
  { label: "Düsseldorf, Germany", latitude: 51.2277, longitude: 6.7735, keys: ["dusseldorf"] },
  { label: "Germany", latitude: 51.1657, longitude: 10.4515, keys: ["germany", "deutschland"] },
  {
    label: "Paris, France",
    latitude: 48.8566,
    longitude: 2.3522,
    keys: ["paris", "ile de france", "hauts de seine"]
  },
  { label: "Lyon, France", latitude: 45.764, longitude: 4.8357, keys: ["lyon", "limonest"] },
  {
    label: "Lille, France",
    latitude: 50.6292,
    longitude: 3.0573,
    keys: ["lille", "la madeleine", "roubaix", "hauts de france", "nord"]
  },
  {
    label: "Toulouse, France",
    latitude: 43.6047,
    longitude: 1.4442,
    keys: ["toulouse", "haute garonne"]
  },
  {
    label: "Montpellier, France",
    latitude: 43.6108,
    longitude: 3.8767,
    keys: ["montpellier", "herault"]
  },
  {
    label: "Aix-en-Provence, France",
    latitude: 43.5297,
    longitude: 5.4474,
    keys: ["aix en provence"]
  },
  {
    label: "Marseille, France",
    latitude: 43.2965,
    longitude: 5.3698,
    keys: ["marseille", "allauch"]
  },
  { label: "Toulon, France", latitude: 43.1242, longitude: 5.928, keys: ["toulon", "var"] },
  { label: "France", latitude: 46.2276, longitude: 2.2137, keys: ["france"] },
  { label: "Madrid, Spain", latitude: 40.4168, longitude: -3.7038, keys: ["madrid"] },
  { label: "Barcelona, Spain", latitude: 41.3874, longitude: 2.1686, keys: ["barcelona"] },
  { label: "Albacete, Spain", latitude: 38.9942, longitude: -1.8564, keys: ["albacete"] },
  {
    label: "Vitoria-Gasteiz, Spain",
    latitude: 42.8467,
    longitude: -2.6727,
    keys: ["vitoria gasteiz", "alava"]
  },
  { label: "Spain", latitude: 40.4637, longitude: -3.7492, keys: ["spain", "espana"] },
  { label: "Milan, Italy", latitude: 45.4642, longitude: 9.19, keys: ["milan", "milano"] },
  { label: "Rome, Italy", latitude: 41.9028, longitude: 12.4964, keys: ["rome", "roma"] },
  { label: "Turin, Italy", latitude: 45.0703, longitude: 7.6869, keys: ["turin", "torino"] },
  { label: "Italy", latitude: 41.8719, longitude: 12.5674, keys: ["italy", "italia"] },
  {
    label: "Zurich, Switzerland",
    latitude: 47.3769,
    longitude: 8.5417,
    keys: ["zurich", "fehraltorf", "uitikon", "dietikon", "horgen"]
  },
  { label: "Bern, Switzerland", latitude: 46.948, longitude: 7.4474, keys: ["bern mittelland", "zollikofen", "koniz"] },
  {
    label: "Basel, Switzerland",
    latitude: 47.5596,
    longitude: 7.5886,
    keys: ["basel", "basel city", "liestal", "basel landschaft"]
  },
  { label: "Geneva, Switzerland", latitude: 46.2044, longitude: 6.1432, keys: ["geneva", "genf"] },
  { label: "Lausanne, Switzerland", latitude: 46.5197, longitude: 6.6323, keys: ["lausanne"] },
  { label: "St. Gallen, Switzerland", latitude: 47.4245, longitude: 9.3767, keys: ["st gallen", "sankt gallen", "teufen"] },
  { label: "Aarau, Switzerland", latitude: 47.3904, longitude: 8.0457, keys: ["aarau"] },
  { label: "Schwyz, Switzerland", latitude: 47.0207, longitude: 8.6541, keys: ["schwyz"] },
  { label: "Lucerne, Switzerland", latitude: 47.0502, longitude: 8.3093, keys: ["lucerne", "luzern", "kriens"] },
  { label: "Chur, Switzerland", latitude: 46.8508, longitude: 9.532, keys: ["chur", "plessur"] },
  { label: "Sarnen, Switzerland", latitude: 46.8961, longitude: 8.2453, keys: ["sarnen", "obwalden"] },
  { label: "Fribourg, Switzerland", latitude: 46.8065, longitude: 7.1619, keys: ["fribourg", "villars sur glane", "saane"] },
  { label: "Switzerland", latitude: 46.8182, longitude: 8.2275, keys: ["switzerland", "schweiz", "suisse", "svizzera"] },
  { label: "Hyderabad, India", latitude: 17.385, longitude: 78.4867, keys: ["hyderabad"] },
  { label: "Bengaluru, India", latitude: 12.9716, longitude: 77.5946, keys: ["bengaluru", "bangalore"] },
  { label: "India", latitude: 20.5937, longitude: 78.9629, keys: ["india"] },
  { label: "Cebu City, Philippines", latitude: 10.3157, longitude: 123.8854, keys: ["cebu city"] },
  { label: "Manila, Philippines", latitude: 14.5995, longitude: 120.9842, keys: ["manila"] },
  { label: "Seoul, South Korea", latitude: 37.5665, longitude: 126.978, keys: ["seoul"] },
  { label: "Tel Aviv, Israel", latitude: 32.0853, longitude: 34.7818, keys: ["tel aviv"] },
  { label: "Japan", latitude: 36.2048, longitude: 138.2529, keys: ["japan remote"] }
];

const searchableLocationCoordinates = locationCoordinates.map((coordinate) => ({
  ...coordinate,
  normalizedKeys: coordinate.keys.map(normalizeLocation).filter(Boolean)
}));

export function resolveJobMapLocation(location: string): JobMapLocation | undefined {
  const normalized = normalizeLocation(location);

  if (!normalized || /^\d+ locations$/.test(normalized)) {
    return undefined;
  }

  if (normalized === "us" || normalized === "usa" || normalized === "united states") {
    return getCoordinate("United States");
  }

  const coordinate = searchableLocationCoordinates.find((candidate) =>
    !isGermanCityWithExplicitUsState(candidate.label, normalized) &&
    candidate.normalizedKeys.some((key) => containsNormalizedLocationKey(normalized, key))
  );

  return coordinate ? toMapLocation(coordinate) : undefined;
}

function isGermanCityWithExplicitUsState(label: string, normalizedLocation: string) {
  if (!label.endsWith(", Germany")) {
    return false;
  }

  const locationWithoutCountry = normalizedLocation.replace(
    / (?:us|usa|united states(?: of america)?)$/,
    ""
  );
  const locationWithoutTrailingZip = locationWithoutCountry.replace(/ \d{5}(?: \d{4})?$/, "");

  return /(?:^| )(?:al|ak|az|ar|ca|co|ct|dc|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)$/.test(
    locationWithoutTrailingZip
  );
}

function containsNormalizedLocationKey(normalizedLocation: string, normalizedKey: string) {
  return ` ${normalizedLocation} `.includes(` ${normalizedKey} `);
}

function getCoordinate(label: string) {
  const coordinate = locationCoordinates.find((candidate) => candidate.label === label);
  return coordinate ? toMapLocation(coordinate) : undefined;
}

function toMapLocation({ label, latitude, longitude }: Coordinate): JobMapLocation {
  return { label, latitude, longitude };
}

function normalizeLocation(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
