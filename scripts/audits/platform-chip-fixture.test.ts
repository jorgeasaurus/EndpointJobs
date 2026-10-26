import assert from "node:assert/strict";
import test from "node:test";

import { isActiveJob, getJobDescriptionBlocks } from "../../src/lib/jobs";
import {
  createPlatformChipFixture,
  platformChipFixtureId,
  seedPlatformChipFixture
} from "../../src/lib/platform-chip-fixture";

test("platform chip fixture stays active and carries Windows and macOS", () => {
  const now = new Date("2026-10-26T00:00:00.000Z");
  const fixture = createPlatformChipFixture(now);

  assert.equal(fixture.id, platformChipFixtureId);
  assert.equal(isActiveJob(fixture, now), true);
  assert.ok(fixture.platforms.includes("Windows"));
  assert.ok(fixture.platforms.includes("macOS"));
  assert.ok(getJobDescriptionBlocks(fixture).some((block) => block.type === "list" && block.items.length > 1));
});

test("platform chip fixture is prepended only when E2E_FIXTURES=1", () => {
  const existing = createPlatformChipFixture();
  existing.id = "real-job";
  const previous = process.env.E2E_FIXTURES;

  try {
    delete process.env.E2E_FIXTURES;
    assert.deepEqual(seedPlatformChipFixture([existing]).map((job) => job.id), ["real-job"]);

    process.env.E2E_FIXTURES = "1";
    const enabled = seedPlatformChipFixture([existing]);
    assert.deepEqual(enabled.map((job) => job.id), [platformChipFixtureId, "real-job"]);
    assert.deepEqual(
      seedPlatformChipFixture(enabled).map((job) => job.id),
      [platformChipFixtureId, "real-job"]
    );
  } finally {
    if (previous === undefined) delete process.env.E2E_FIXTURES;
    else process.env.E2E_FIXTURES = previous;
  }
});
