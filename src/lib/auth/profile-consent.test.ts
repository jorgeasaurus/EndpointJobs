import assert from "node:assert/strict";
import test from "node:test";

import { saveProfileOnSignIn, type ProfileConsent } from "./profile-consent";

type StoredProfile = {
  email: string;
  privacyVersion: string;
};

function memoryProfiles() {
  const rows = new Map<string, StoredProfile>();

  return {
    rows,
    async insertProfile(profile: ProfileConsent) {
      if (rows.has(profile.id)) return { error: { code: "23505" } };
      rows.set(profile.id, { email: profile.email, privacyVersion: profile.privacyVersion });
      return { error: null };
    },
    async updateEmail(id: string, email: string) {
      const existing = rows.get(id);
      if (!existing) return { error: new Error("missing profile") };
      rows.set(id, { email, privacyVersion: existing.privacyVersion });
      return { error: null };
    }
  };
}

test("a returning sign-in keeps the privacy version the user already accepted", async () => {
  const profiles = memoryProfiles();
  const first = await saveProfileOnSignIn({
    profile: { id: "user-1", email: "a@example.com", privacyVersion: "2026-10-24" },
    insertProfile: profiles.insertProfile,
    updateEmail: profiles.updateEmail
  });
  const returning = await saveProfileOnSignIn({
    profile: { id: "user-1", email: "new@example.com", privacyVersion: "2027-01-01" },
    insertProfile: profiles.insertProfile,
    updateEmail: profiles.updateEmail
  });

  assert.equal(first.error, null);
  assert.equal(returning.error, null);
  assert.deepEqual(profiles.rows.get("user-1"), {
    email: "new@example.com",
    privacyVersion: "2026-10-24"
  });
});

test("a profile insert error other than a duplicate is not turned into an email update", async () => {
  let updates = 0;
  const result = await saveProfileOnSignIn({
    profile: { id: "user-1", email: "a@example.com", privacyVersion: "2026-10-24" },
    insertProfile: async () => ({ error: { code: "42501" } }),
    updateEmail: async () => {
      updates += 1;
      return { error: null };
    }
  });

  assert.equal(updates, 0);
  assert.equal((result.error as { code?: string }).code, "42501");
});
