import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("job dates render identically across server and browser time zones", () => {
  const outputs = ["UTC", "America/Los_Angeles", "Asia/Tokyo"].map((TZ) =>
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { formatPostedDate, formatUpdatedAt } from './src/lib/jobs.ts';
      console.log(JSON.stringify([
        formatPostedDate('2026-10-04T00:30:00Z'),
        formatUpdatedAt('2026-10-04T00:30:00Z'),
        formatUpdatedAt('invalid')
      ]));
    `], { env: { ...process.env, TZ }, encoding: "utf8" }).trim()
  );
  assert.equal(outputs[1], outputs[0]);
  assert.equal(outputs[2], outputs[0]);
  assert.match(outputs[0], /Oct 4/);
  assert.match(outputs[0], /Pending refresh/);
});
