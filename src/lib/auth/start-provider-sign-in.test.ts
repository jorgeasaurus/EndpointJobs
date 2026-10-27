import assert from "node:assert/strict";
import test from "node:test";

import { signInStartError, startProviderSignIn } from "./start-provider-sign-in";

test("a failed OAuth start surfaces the shared sign-in error", async () => {
  let redirectTo = "";
  const message = await startProviderSignIn("google", {
    origin: "https://endpointjobs.dev",
    pathAndQuery: "/?q=jamf",
    start: async (input) => {
      redirectTo = input.redirectTo;
      assert.equal(input.provider, "google");
      return { error: { message: "provider down" } };
    }
  });

  assert.equal(message, signInStartError);
  assert.match(redirectTo, /^https:\/\/endpointjobs\.dev\/auth\/callback\?/);
  assert.match(redirectTo, /next=%2F%3Fq%3Djamf/);
});

test("a thrown OAuth client and a successful start stay on the same result type", async () => {
  const thrown = await startProviderSignIn("github", {
    origin: "https://endpointjobs.dev",
    pathAndQuery: "/",
    start: async () => {
      throw new Error("Supabase browser env is not configured");
    }
  });
  const started = await startProviderSignIn("github", {
    origin: "https://endpointjobs.dev",
    pathAndQuery: "/",
    start: async () => ({ error: null })
  });

  assert.equal(thrown, signInStartError);
  assert.equal(started, null);
});
