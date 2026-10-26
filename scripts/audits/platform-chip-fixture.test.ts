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

test("platform chip fixture is prepended only when seeding is enabled", () => {
  const existing = createPlatformChipFixture();
  existing.id = "real-job";
  const disabled = seedPlatformChipFixture([existing], false);
  assert.deepEqual(disabled.map((job) => job.id), ["real-job"]);

  const enabled = seedPlatformChipFixture([existing], true);
  assert.deepEqual(enabled.map((job) => job.id), [platformChipFixtureId, "real-job"]);
  assert.deepEqual(
    seedPlatformChipFixture(enabled, true).map((job) => job.id),
    [platformChipFixtureId, "real-job"]
  );
});
