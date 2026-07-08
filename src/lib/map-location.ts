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
    keys: ["new york city", "grand central", "manhattan", "brooklyn", "flatbush"]
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
  { label: "Hamburg, Germany", latitude: 53.5511, longitude: 9.9937, keys: ["hamburg"] },
  { label: "Zurich, Switzerland", latitude: 47.3769, longitude: 8.5417, keys: ["zurich", "z rich", "fehraltorf"] },
  { label: "Basel, Switzerland", latitude: 47.5596, longitude: 7.5886, keys: ["basel", "basel city"] },
  { label: "Geneva, Switzerland", latitude: 46.2044, longitude: 6.1432, keys: ["geneva"] },
  { label: "Lausanne, Switzerland", latitude: 46.5197, longitude: 6.6323, keys: ["lausanne"] },
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

export function resolveJobMapLocation(location: string): JobMapLocation | undefined {
  const normalized = normalizeLocation(location);

  if (!normalized || /^\d+ locations$/.test(normalized)) {
    return undefined;
  }

  if (normalized === "us" || normalized === "usa" || normalized === "united states") {
    return getCoordinate("United States");
  }

  const coordinate = locationCoordinates.find((candidate) =>
    candidate.keys.some((key) => normalized.includes(key))
  );

  return coordinate ? toMapLocation(coordinate) : undefined;
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
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
