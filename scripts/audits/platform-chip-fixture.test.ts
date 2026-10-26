import assert from "node:assert/strict";
import test from "node:test";

import { isActiveJob, getJobDescriptionBlocks } from "../../src/lib/jobs";
import {
  createPlatformChipFixture,
  platformChipFixtureId,
  seedPlatformChipFixture
} from "../../src/lib/platform-chip-fixture";

function setEnv(name: "E2E_FIXTURES" | "NEXT_PHASE" | "NODE_ENV", value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[name];
  else env[name] = value;
}

test("platform chip fixture stays active and carries Windows and macOS", () => {
  const now = new Date("2026-10-26T00:00:00.000Z");
  const fixture = createPlatformChipFixture(now);

  assert.equal(fixture.id, platformChipFixtureId);
  assert.equal(isActiveJob(fixture, now), true);
  assert.ok(fixture.platforms.includes("Windows"));
  assert.ok(fixture.platforms.includes("macOS"));
  assert.ok(getJobDescriptionBlocks(fixture).some((block) => block.type === "list" && block.items.length > 1));
});

test("platform chip fixture is prepended only for a non-production E2E_FIXTURES=1", () => {
  const existing = createPlatformChipFixture();
  existing.id = "real-job";
  const previousFixtures = process.env.E2E_FIXTURES;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPhase = process.env.NEXT_PHASE;

  try {
    setEnv("E2E_FIXTURES", undefined);
    setEnv("NEXT_PHASE", undefined);
    setEnv("NODE_ENV", "development");
    assert.deepEqual(seedPlatformChipFixture([existing]).map((job) => job.id), ["real-job"]);

    setEnv("E2E_FIXTURES", "true");
    assert.deepEqual(seedPlatformChipFixture([existing]).map((job) => job.id), ["real-job"]);

    setEnv("E2E_FIXTURES", "1");
    setEnv("NODE_ENV", "production");
    assert.deepEqual(seedPlatformChipFixture([existing]).map((job) => job.id), ["real-job"]);

    setEnv("NODE_ENV", "development");
    setEnv("NEXT_PHASE", "phase-production-build");
    assert.deepEqual(seedPlatformChipFixture([existing]).map((job) => job.id), ["real-job"]);

    setEnv("NEXT_PHASE", "phase-production-server");
    assert.deepEqual(seedPlatformChipFixture([existing]).map((job) => job.id), ["real-job"]);

    setEnv("NEXT_PHASE", undefined);
    const enabled = seedPlatformChipFixture([existing]);
    assert.deepEqual(enabled.map((job) => job.id), [platformChipFixtureId, "real-job"]);
    assert.deepEqual(
      seedPlatformChipFixture(enabled).map((job) => job.id),
      [platformChipFixtureId, "real-job"]
    );
  } finally {
    setEnv("E2E_FIXTURES", previousFixtures);
    setEnv("NODE_ENV", previousNodeEnv);
    setEnv("NEXT_PHASE", previousPhase);
  }
});
