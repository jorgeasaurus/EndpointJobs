import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PRIVACY_POLICY_VERSION } from "@/app/privacy/version";

import { handleAuthCallback } from "./callback-session";

const origin = "https://endpointjobs.dev";

test("a failed code exchange redirects home without signing out", async () => {
  let signOuts = 0;
  const result = await handleAuthCallback({
    requestUrl: `${origin}/auth/callback?code=invalid&next=${encodeURIComponent("/?q=C%2B%2B")}`,
    exchangeCode: async () => ({ error: new Error("invalid grant"), user: null }),
    upsertProfile: async () => {
      assert.fail("profile upsert should not run after a failed exchange");
    },
    signOutLocal: async () => {
      signOuts += 1;
    }
  });

  assert.equal(signOuts, 0);
  assert.equal(result.href, `${origin}/`);
});

test("a session this callback just established is cleared locally when the profile cannot be saved", async () => {
  const calls: string[] = [];
  const result = await handleAuthCallback({
    requestUrl: `${origin}/auth/callback?code=ok&next=/jobs`,
    exchangeCode: async () => ({ error: null, user: { id: "user-1", email: "a@example.com" } }),
    upsertProfile: async (profile) => {
      calls.push(`upsert:${profile.email}:${profile.privacyVersion}`);
      return { error: new Error("rls") };
    },
    signOutLocal: async () => {
      calls.push("local");
    }
  });

  assert.deepEqual(calls, [`upsert:a@example.com:${PRIVACY_POLICY_VERSION}`, "local"]);
  assert.equal(result.href, `${origin}/`);
});

test("a user with no email is signed out locally and not written to profiles", async () => {
  let upserts = 0;
  let signOuts = 0;
  const result = await handleAuthCallback({
    requestUrl: `${origin}/auth/callback?code=ok`,
    exchangeCode: async () => ({ error: null, user: { id: "user-1", identities: [] } }),
    upsertProfile: async () => {
      upserts += 1;
      return { error: null };
    },
    signOutLocal: async () => {
      signOuts += 1;
    }
  });

  assert.equal(upserts, 0);
  assert.equal(signOuts, 1);
  assert.equal(result.href, `${origin}/`);
});

test("a successful callback keeps the escaped next path and does not sign out", async () => {
  let signOuts = 0;
  const result = await handleAuthCallback({
    requestUrl: `${origin}/auth/callback?code=ok&next=${encodeURIComponent("/?q=R%26D")}`,
    exchangeCode: async () => ({
      error: null,
      user: {
        id: "user-1",
        identities: [{ identity_data: { email: "from-provider@example.com" } }]
      }
    }),
    upsertProfile: async (profile) => {
      assert.equal(profile.email, "from-provider@example.com");
      return { error: null };
    },
    signOutLocal: async () => {
      signOuts += 1;
    }
  });

  assert.equal(signOuts, 0);
  assert.equal(result.href, `${origin}/?q=R%26D`);
  assert.equal(result.searchParams.get("q"), "R&D");
});

test("the callback route only signs out the session it just established", () => {
  const source = readFileSync(new URL("../../app/auth/callback/route.ts", import.meta.url), "utf8");
  assert.match(source, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.doesNotMatch(source, /signOut\(\s*\)/);
});
