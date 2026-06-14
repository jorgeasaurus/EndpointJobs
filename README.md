# Endpoint Jobs

Focused job board for Endpoint Engineering, macOS, Windows, MDM, UEM, client platform, and endpoint security roles.

## Run

```bash
npm install
npm run dev
```

## Refresh Jobs

```bash
npm run jobs:refresh
```

Default providers: Remotive, Arbeitnow, Jobicy, Remote OK, Greenhouse, Lever, The Muse, Ashby, Amazon Jobs, Workday, Jibe, and Activate. Workable, Techmap RSS, and Adzuna are supported when their required configuration is present.

Use `JOB_PROVIDERS=remotive,arbeitnow,jobicy,remoteok,greenhouse,lever,muse,ashby,workable,amazon,workday,jibe,activate,techmaprss,adzuna` to choose sources. Single-provider legacy mode still works with `JOB_PROVIDER=remoteok` and `JOB_API_URL=https://remoteok.com/api`. Override individual URLs with `JOB_REMOTIVE_API_URL`, `JOB_ARBEITNOW_API_URL`, `JOB_JOBICY_API_URL`, `JOB_REMOTEOK_API_URL`, `JOB_GREENHOUSE_API_URL`, `JOB_LEVER_API_URL`, `JOB_MUSE_API_URL`, `JOB_ASHBY_API_URL`, `JOB_WORKABLE_API_URL`, `JOB_AMAZON_API_URL`, `JOB_WORKDAY_API_URL`, `JOB_JIBE_API_URL`, `JOB_ACTIVATE_API_URL`, `JOB_TECHMAP_RSS_API_URL`, or `JOB_ADZUNA_API_URL`.

Career-board defaults include Greenhouse boards for Jamf, Automox, Tanium, Okta, PlayStation, Verkada, Anthropic, DoorDash, Commvault, Kaseya, and Kymera; Lever companies JumpCloud, Brighton Jones, Hermeus, and Omnidian; Ashby board Docker; targeted Amazon, Workday, Jibe, and Activate searches; and `JOB_MUSE_PAGES=5`. Workable uses `JOB_WORKABLE_ACCOUNTS=slug` or `Display Name|slug` entries, with optional `JOB_WORKABLE_DETAIL_API_URL` for v1 detail overrides. Techmap RSS uses `JOB_TECHMAP_RSS_FEEDS=url` or `Feed Name|url` entries, with optional `JOB_TECHMAP_RSS_AUTH_HEADER` or `TECHMAP_RSS_TOKEN`. Adzuna defaults to US searches from `JOB_ADZUNA_QUERIES`.

## GitHub Action

`.github/workflows/refresh-jobs.yml` runs daily, writes `src/data/jobs.json`, verifies `npm run build`, commits changes, and lets Vercel redeploy from Git.

## Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: Next.js.
3. Build command: `npm run build`.
4. Keep Git integration enabled for redeploys after the daily feed commit.
