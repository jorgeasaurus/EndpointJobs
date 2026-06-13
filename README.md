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

Default providers: Remotive, Arbeitnow, Jobicy, and Remote OK. The site preserves source/apply links and displays attribution.

Use `JOB_PROVIDERS=remotive,arbeitnow,jobicy,remoteok` to choose sources. Single-provider legacy mode still works with `JOB_PROVIDER=remoteok` and `JOB_API_URL=https://remoteok.com/api`. Override individual URLs with `JOB_REMOTIVE_API_URL`, `JOB_ARBEITNOW_API_URL`, `JOB_JOBICY_API_URL`, or `JOB_REMOTEOK_API_URL`.

## GitHub Action

`.github/workflows/refresh-jobs.yml` runs daily, writes `src/data/jobs.json`, verifies `npm run build`, commits changes, and lets Vercel redeploy from Git.

## Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: Next.js.
3. Build command: `npm run build`.
4. Keep Git integration enabled for redeploys after the daily feed commit.
