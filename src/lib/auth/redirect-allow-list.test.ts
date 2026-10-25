import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildOAuthRedirectTo } from "./safe-next-path";
import { globMatch, redirectAllowListCovers } from "./redirect-allow-list";

const config = readFileSync(new URL("../../../supabase/config.toml", import.meta.url), "utf8");

function tomlValue(name: string) {
  const match = config.match(new RegExp(`^${name}\\s*=\\s*(.+)$`, "m"));
  assert.ok(match, name);
  return match[1] ?? "";
}

function quotedList(value: string) {
  return [...value.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? "");
}

const localPatterns = quotedList(tomlValue("additional_redirect_urls"));
const siteUrl = tomlValue("site_url").replaceAll('"', "");

test("gobwas-style globs keep the query and stop single-star at dots", () => {
  const callback = "http://localhost:3000/auth/callback?next=%2Fjobs%2Ffile.js";
  assert.equal(globMatch("http://localhost:3000/auth/callback", callback), false);
  assert.equal(globMatch("http://localhost:3000/auth/callback?*", callback), false);
  assert.equal(globMatch("http://localhost:3000/auth/callback**", callback), true);
  assert.equal(globMatch("http://localhost:3000/auth/callback**", "http://localhost:3000/auth/callback"), true);
  assert.equal(
    globMatch("http://localhost:3000/**", "http://localhost:3000/steal?next=%2F"),
    true
  );
  assert.equal(
    redirectAllowListCovers(
      ["http://localhost:3000/auth/callback**"],
      "http://localhost:3000/auth/callback?next=%2Fjobs%2Ffile.js#frag"
    ),
    true
  );
});

test("local Supabase config allows the query-bearing OAuth callback", () => {
  assert.deepEqual(localPatterns, [
    "http://127.0.0.1:3000/auth/callback**",
    "http://localhost:3000/auth/callback**"
  ]);
  assert.equal(siteUrl, "http://127.0.0.1:3000");

  for (const origin of ["http://127.0.0.1:3000", "http://localhost:3000"]) {
    for (const path of ["/", "/privacy", "/?q=C%2B%2B", "/jobs/file.js?q=R%26D", "/?q=100%25"]) {
      const redirectTo = buildOAuthRedirectTo(origin, path);
      assert.match(redirectTo, /\?next=/, redirectTo);
      assert.equal(redirectAllowListCovers(localPatterns, redirectTo), true, redirectTo);
      assert.equal(
        redirectAllowListCovers([`${origin}/auth/callback`], redirectTo),
        false,
        redirectTo
      );
    }
  }

  const localhostCallback = buildOAuthRedirectTo("http://localhost:3000", "/jobs");
  assert.notEqual(new URL(siteUrl).pathname, new URL(localhostCallback).pathname);
  assert.equal(redirectAllowListCovers(localPatterns, "http://localhost:3000/steal?next=%2F"), false);
  assert.equal(redirectAllowListCovers(localPatterns, "http://evil.example/auth/callback?next=%2F"), false);
});

test("hosted redirect patterns match production, local, and this project's Vercel previews", () => {
  const hosted = [
    "https://endpointjobs.dev/auth/callback**",
    "http://localhost:3000/auth/callback**",
    "http://127.0.0.1:3000/auth/callback**",
    "https://*-jorgeasaurus-projects.vercel.app/auth/callback**"
  ];
  const samples = [
    buildOAuthRedirectTo("https://endpointjobs.dev", "/?q=C%2B%2B"),
    buildOAuthRedirectTo("http://localhost:3000", "/privacy"),
    buildOAuthRedirectTo("http://127.0.0.1:3000", "/jobs/file.js"),
    "https://endpoint-jobs-git-cursor-auth-foun-4f781c-jorgeasaurus-projects.vercel.app/auth/callback?next=%2F",
    "https://endpoint-jobs-r8r28o7bf-jorgeasaurus-projects.vercel.app/auth/callback?next=%2Fprivacy"
  ];
  for (const redirectTo of samples) {
    assert.equal(redirectAllowListCovers(hosted, redirectTo), true, redirectTo);
    assert.equal(
      redirectAllowListCovers(["https://*-.vercel.app/**"], samples[3] ?? ""),
      false
    );
  }
  assert.equal(redirectAllowListCovers(hosted, "https://evil.vercel.app/auth/callback?next=%2F"), false);
  assert.equal(redirectAllowListCovers(hosted, "https://endpointjobs.dev/steal?next=%2F"), false);
});
