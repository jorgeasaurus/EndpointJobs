# Jobs API

Base URL: `https://endpointjobs.dev`

The API is public, read-only, and requires no authentication. It returns active listings from the same normalized feed used by the job board.

Machine-readable contract: [`/openapi.json`](../public/openapi.json)

## List jobs

```http
GET /api/jobs?tools=Jamf&platforms=macOS&minSalary=150000&page=1&limit=20
```

```json
{
  "data": [{ "id": "...", "title": "Endpoint Engineer" }],
  "filters": { "tools": ["Jamf"], "minSalary": "150000" },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 30,
    "totalPages": 2,
    "updatedAt": "2026-07-12T22:35:39.294Z"
  }
}
```

| Parameter | Values |
| --- | --- |
| `q` | Search text, 1–200 characters |
| `platforms` | Comma-separated: `macOS`, `Windows`, `iOS`, `Android`, `Linux` |
| `tools` | Comma-separated endpoint tools, such as `Jamf`, `Intune`, or `SCCM` |
| `location` | City, state, or country text, 1–200 characters |
| `workplace` | `Remote`, `Hybrid`, or `On-site` |
| `salary` | `1` to require disclosed compensation |
| `minSalary` | USD floor: `80000`, `100000`, `120000`, `150000`, `180000`, `200000` |
| `seniority` | `Associate`, `Mid`, `Senior`, `Staff`, `Lead`, or `Manager` |
| `family` | Role family listed in the OpenAPI enum |
| `freshness` | Posted within `7`, `14`, or `30` days |
| `sort` | `newest`, `salary`, or `company` |
| `page` | Positive integer; default `1` |
| `limit` | `1`–`100`; default `20` |

Repeated or unknown parameters are rejected. Multi-value filters use one comma-separated parameter, not repeated keys.

## Get one job

```http
GET /api/jobs/{id}
```

Returns `{ "data": Job, "meta": { "updatedAt": "..." } }`. Inactive, expired, excluded, and unknown IDs return `404`.

## Errors

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "One or more query parameters are invalid.",
    "details": ["limit must be an integer between 1 and 100"]
  }
}
```

| Status | Code |
| --- | --- |
| `400` | `INVALID_QUERY` |
| `404` | `JOB_NOT_FOUND` |

## Caching and CORS

Successful responses use `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`. Errors use `no-store`. Cross-origin `GET` requests are allowed with `Access-Control-Allow-Origin: *`.
