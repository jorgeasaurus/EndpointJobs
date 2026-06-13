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

Default provider: Remotive public API. The site preserves source/apply links and displays attribution. Set `JOB_PROVIDER=remoteok` and `JOB_API_URL=https://remoteok.com/api` to use Remote OK instead.

## GitHub Action

`.github/workflows/refresh-jobs.yml` runs daily, writes `src/data/jobs.json`, verifies `npm run build`, commits changes, and lets Vercel redeploy from Git.

## Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: Next.js.
3. Build command: `npm run build`.
4. Keep Git integration enabled for redeploys after the daily feed commit.
