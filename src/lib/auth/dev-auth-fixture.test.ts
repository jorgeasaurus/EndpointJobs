import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { devAuthFixture } from "./dev-auth-fixture";

test("the dev auth fixture only invents a session when the caller enables it", () => {
  assert.equal(devAuthFixture("?e2e-auth=in", false), null);
  assert.equal(devAuthFixture("?e2e-auth=out", false), null);
  assert.equal(devAuthFixture("", true), null);
  assert.deepEqual(devAuthFixture("?e2e-auth=out", true), { configured: true, email: null });
  assert.deepEqual(devAuthFixture("?e2e-auth=off", true), { configured: false, email: null });
  assert.deepEqual(devAuthFixture("e2e-auth=in", true), {
    configured: true,
    email: "jorgesuarez@gmail.com"
  });
  assert.deepEqual(devAuthFixture("?e2e-auth=in&e2e-email=person@example.com", true), {
    configured: true,
    email: "person@example.com"
  });
  assert.deepEqual(devAuthFixture("?e2e-auth=in&e2e-email=%20%20", true), {
    configured: true,
    email: "jorgesuarez@gmail.com"
  });

  const source = readFileSync(new URL("../../components/auth/sign-in-session.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /devAuthFixture\(window\.location\.search, process\.env\.NODE_ENV !== "production"\)/
  );
});
