import { isJamaicaUsNeighborhood, isNewMexicoUsLocation } from "@/lib/text";
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
    label: "Mooresville, NC",
    latitude: 35.5849,
    longitude: -80.8101,
    keys: ["mooresville nc"]
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
  {
    label: "Mexico City, Mexico",
    latitude: 19.4326,
    longitude: -99.1332,
    keys: ["mexico city", "cdmx", "ciudad de mexico", "mexico df"]
  },
  { label: "Guadalajara, Mexico", latitude: 20.6597, longitude: -103.3496, keys: ["guadalajara"] },
  { label: "Monterrey, Mexico", latitude: 25.6866, longitude: -100.3161, keys: ["monterrey"] },
  { label: "Mexico", latitude: 23.6345, longitude: -102.5528, keys: ["mexico"] },
  {
    label: "Guatemala City, Guatemala",
    latitude: 14.6349,
    longitude: -90.5069,
    keys: ["guatemala city", "ciudad de guatemala"]
  },
  { label: "Guatemala", latitude: 15.7835, longitude: -90.2308, keys: ["guatemala"] },
  { label: "Belize", latitude: 17.1899, longitude: -88.4976, keys: ["belize"] },
  {
    label: "San Salvador, El Salvador",
    latitude: 13.6929,
    longitude: -89.2182,
    keys: ["san salvador"]
  },
  { label: "El Salvador", latitude: 13.7942, longitude: -88.8965, keys: ["el salvador"] },
  {
    label: "Tegucigalpa, Honduras",
    latitude: 14.0723,
    longitude: -87.1921,
    keys: ["tegucigalpa"]
  },
  { label: "Honduras", latitude: 15.2, longitude: -86.2419, keys: ["honduras"] },
  { label: "Managua, Nicaragua", latitude: 12.115, longitude: -86.2362, keys: ["managua"] },
  { label: "Nicaragua", latitude: 12.8654, longitude: -85.2072, keys: ["nicaragua"] },
  {
    label: "San José, Costa Rica",
    latitude: 9.9281,
    longitude: -84.0907,
    keys: ["san jose costa rica", "san jose cr"]
  },
  { label: "Costa Rica", latitude: 9.7489, longitude: -83.7534, keys: ["costa rica"] },
  {
    label: "Panama City, Panama",
    latitude: 8.9824,
    longitude: -79.5199,
    keys: ["panama city panama", "ciudad de panama"]
  },
  { label: "Panama", latitude: 8.538, longitude: -80.7821, keys: ["panama"] },
  {
    label: "Central America",
    latitude: 12.769,
    longitude: -85.6024,
    keys: ["central america", "centroamerica", "america central", "centro america"]
  },
  {
    label: "São Paulo, Brazil",
    latitude: -23.5505,
    longitude: -46.6333,
    keys: ["sao paulo", "sao paulo sp", "sao paulo brasil"]
  },
  {
    label: "Rio de Janeiro, Brazil",
    latitude: -22.9068,
    longitude: -43.1729,
    keys: ["rio de janeiro"]
  },
  { label: "Brasília, Brazil", latitude: -15.7975, longitude: -47.8919, keys: ["brasilia", "brasilia df"] },
  { label: "Brazil", latitude: -14.235, longitude: -51.9253, keys: ["brazil", "brasil"] },
  {
    label: "Buenos Aires, Argentina",
    latitude: -34.6037,
    longitude: -58.3816,
    keys: ["buenos aires argentina", "caba", "capital federal"]
  },
  { label: "Argentina", latitude: -38.4161, longitude: -63.6167, keys: ["argentina"] },
  {
    label: "Santiago, Chile",
    latitude: -33.4489,
    longitude: -70.6693,
    keys: ["santiago chile", "santiago de chile"]
  },
  { label: "Chile", latitude: -35.6751, longitude: -71.543, keys: ["chile"] },
  {
    label: "Bogotá, Colombia",
    latitude: 4.711,
    longitude: -74.0721,
    keys: ["bogota", "bogota dc", "bogota colombia"]
  },
  { label: "Medellín, Colombia", latitude: 6.2476, longitude: -75.5658, keys: ["medellin"] },
  { label: "Colombia", latitude: 4.5709, longitude: -74.2973, keys: ["colombia"] },
  {
    label: "Lima, Peru",
    latitude: -12.0464,
    longitude: -77.0428,
    keys: ["lima peru", "lima pe"]
  },
  { label: "Peru", latitude: -9.19, longitude: -75.0152, keys: ["peru"] },
  {
    label: "Quito, Ecuador",
    latitude: -0.1807,
    longitude: -78.4678,
    keys: ["quito", "quito ecuador"]
  },
  {
    label: "Guayaquil, Ecuador",
    latitude: -2.1894,
    longitude: -79.8891,
    keys: ["guayaquil", "guayaquil ecuador"]
  },
  { label: "Ecuador", latitude: -1.8312, longitude: -78.1834, keys: ["ecuador"] },
  {
    label: "Montevideo, Uruguay",
    latitude: -34.9011,
    longitude: -56.1645,
    keys: ["montevideo", "montevideo uruguay"]
  },
  { label: "Uruguay", latitude: -32.5228, longitude: -55.7658, keys: ["uruguay"] },
  {
    label: "Asunción, Paraguay",
    latitude: -25.2637,
    longitude: -57.5759,
    keys: ["asuncion", "asuncion paraguay"]
  },
  { label: "Paraguay", latitude: -23.4425, longitude: -58.4438, keys: ["paraguay"] },
  {
    label: "La Paz, Bolivia",
    latitude: -16.5,
    longitude: -68.15,
    keys: ["la paz bolivia", "la paz bo"]
  },
  {
    label: "Santa Cruz, Bolivia",
    latitude: -17.8146,
    longitude: -63.1561,
    keys: ["santa cruz bolivia", "santa cruz de la sierra", "santa cruz bo"]
  },
  { label: "Bolivia", latitude: -16.2902, longitude: -63.5887, keys: ["bolivia"] },
  {
    label: "Santo Domingo, Dominican Republic",
    latitude: 18.4861,
    longitude: -69.9312,
    keys: [
      "santo domingo dominican republic",
      "santo domingo do",
      "santo domingo dr",
      "santo domingo"
    ]
  },
  {
    label: "Dominican Republic",
    latitude: 18.7357,
    longitude: -70.1627,
    keys: ["dominican republic", "republica dominicana"]
  },
  {
    label: "Kingston, Jamaica",
    latitude: 17.9714,
    longitude: -76.7931,
    keys: ["kingston jamaica", "kingston jm"]
  },
  { label: "Jamaica", latitude: 18.1096, longitude: -77.2975, keys: ["jamaica"] },
  {
    label: "San Juan, Puerto Rico",
    latitude: 18.4655,
    longitude: -66.1057,
    keys: ["san juan puerto rico", "san juan pr"]
  },
  { label: "Puerto Rico", latitude: 18.2208, longitude: -66.5901, keys: ["puerto rico"] },
  {
    label: "Caribbean",
    latitude: 15.0,
    longitude: -73.0,
    keys: ["caribbean", "caribe", "west indies"]
  },
  {
    label: "Latin America",
    latitude: -15.7801,
    longitude: -47.9292,
    keys: [
      "latam",
      "latin america",
      "south america",
      "america latina",
      "america do sul",
      "latinoamerica"
    ]
  },
  { label: "London, UK", latitude: 51.5072, longitude: -0.1276, keys: ["london", "england united kingdom"] },
  { label: "Berlin, Germany", latitude: 52.52, longitude: 13.405, keys: ["berlin"] },
  { label: "Hamburg, Germany", latitude: 53.5511, longitude: 9.9937, keys: ["hamburg"] },
  { label: "Munich, Germany", latitude: 48.1351, longitude: 11.582, keys: ["munich", "munchen", "muenchen"] },
  { label: "Frankfurt, Germany", latitude: 50.1109, longitude: 8.6821, keys: ["frankfurt", "frankfurt am main"] },
  { label: "Cologne, Germany", latitude: 50.9375, longitude: 6.9603, keys: ["cologne", "koln", "koeln"] },
  { label: "Stuttgart, Germany", latitude: 48.7758, longitude: 9.1829, keys: ["stuttgart"] },
  { label: "Düsseldorf, Germany", latitude: 51.2277, longitude: 6.7735, keys: ["dusseldorf", "duesseldorf"] },
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
  { label: "Valencia, Spain", latitude: 39.4699, longitude: -0.3763, keys: ["valencia spain", "valencia es"] },
  { label: "Seville, Spain", latitude: 37.3891, longitude: -5.9845, keys: ["sevilla", "seville"] },
  { label: "Bilbao, Spain", latitude: 43.263, longitude: -2.935, keys: ["bilbao"] },
  { label: "Málaga, Spain", latitude: 36.7213, longitude: -4.4214, keys: ["malaga"] },
  { label: "Zaragoza, Spain", latitude: 41.6488, longitude: -0.8891, keys: ["zaragoza"] },
  {
    label: "Palma, Spain",
    latitude: 39.5696,
    longitude: 2.6502,
    keys: ["palma de mallorca", "palma mallorca", "palma spain", "palma es"]
  },
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
  { label: "Sydney, Australia", latitude: -33.8688, longitude: 151.2093, keys: ["sydney", "new south wales"] },
  { label: "Melbourne, Australia", latitude: -37.8136, longitude: 144.9631, keys: ["melbourne", "victoria australia"] },
  { label: "Brisbane, Australia", latitude: -27.4698, longitude: 153.0251, keys: ["brisbane", "queensland australia"] },
  { label: "Perth, Australia", latitude: -31.9523, longitude: 115.8613, keys: ["perth australia", "perth wa australia", "perth western australia"] },
  { label: "Adelaide, Australia", latitude: -34.9285, longitude: 138.6007, keys: ["adelaide", "south australia"] },
  { label: "Canberra, Australia", latitude: -35.2809, longitude: 149.13, keys: ["canberra", "australian capital territory"] },
  { label: "Australia", latitude: -25.2744, longitude: 133.7751, keys: ["australia", "remote australia", "australian remote"] },
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
    !isInternationalCityWithExplicitUsState(candidate.label, normalized) &&
    candidate.normalizedKeys.some((key) => containsNormalizedLocationKey(normalized, key))
  );

  return coordinate ? toMapLocation(coordinate) : undefined;
}

function isInternationalCityWithExplicitUsState(label: string, normalizedLocation: string) {
  if (label === "San Jose, CA" && hasCostaRicaContext(normalizedLocation)) {
    return true;
  }

  if ((label === "Mexico" || label.endsWith(", Mexico")) && isNewMexicoUsLocation(normalizedLocation)) {
    return true;
  }

  if ((label === "Jamaica" || label.endsWith(", Jamaica")) && isJamaicaUsNeighborhood(normalizedLocation)) {
    return true;
  }

  if (
    (label === "Panama" || label.endsWith(", Panama")) &&
    containsNormalizedLocationKey(normalizedLocation, "panama city") &&
    !hasPanamaCountryContext(normalizedLocation)
  ) {
    return true;
  }

  if (!isUsStateGuardedInternationalLabel(label)) {
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

const usStateGuardedInternationalCountries = [
  "Brazil",
  "Peru",
  "Chile",
  "Colombia",
  "Mexico",
  "Panama",
  "Guatemala",
  "Belize",
  "El Salvador",
  "Honduras",
  "Nicaragua",
  "Costa Rica",
  "Ecuador",
  "Uruguay",
  "Paraguay",
  "Bolivia",
  "Dominican Republic",
  "Jamaica",
  "Puerto Rico",
  "Spain"
] as const;

function isUsStateGuardedInternationalLabel(label: string) {
  if (
    label === "Caribbean" ||
    label === "Central America" ||
    label.endsWith(", Germany") ||
    label.endsWith(", Australia")
  ) {
    return true;
  }

  return usStateGuardedInternationalCountries.some(
    (country) => label === country || label.endsWith(`, ${country}`)
  );
}

function hasCostaRicaContext(normalizedLocation: string) {
  return (
    containsNormalizedLocationKey(normalizedLocation, "costa rica") ||
    containsNormalizedLocationKey(normalizedLocation, "san jose cr")
  );
}

function hasPanamaCountryContext(normalizedLocation: string) {
  return (
    containsNormalizedLocationKey(normalizedLocation, "panama city panama") ||
    containsNormalizedLocationKey(normalizedLocation, "ciudad de panama") ||
    containsNormalizedLocationKey(normalizedLocation, "republic of panama")
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
