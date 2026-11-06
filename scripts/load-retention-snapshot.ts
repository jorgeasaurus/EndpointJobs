import { loadPublishedRetentionSnapshot } from "./job-refresh/retention-snapshot";

async function main() {
  const result = await loadPublishedRetentionSnapshot();
  if (result.status === "failed") console.error(result.detail);
  else console.log(result.detail);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
