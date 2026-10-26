import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { AccountMenu } from "@/components/auth/account-menu";

import { authCookiesToClear, signOutRedirectDecision, signOutRedirectUrl, signOutRequestAllowed } from "./sign-out-navigation";

test("sign-out navigation returns the browser to the same origin", () => {
  const destination = signOutRedirectUrl("https://endpointjobs.dev/auth/sign-out?next=https://evil.example");
  assert.equal(destination.href, "https://endpointjobs.dev/");
});

test("sign-out is limited to this browser and this site", () => {
  assert.equal(signOutRedirectDecision(null), "home");
  assert.equal(signOutRedirectDecision(new Error("revoke failed")), "home");
  assert.deepEqual(
    authCookiesToClear(
      "theme=dark; sb-project-auth-token=session; sb-project-auth-token.0=chunk; sb-project-auth-token.1=rest; sb-project-auth-token-code-verifier=pkce; other=1"
    ),
    [
      "sb-project-auth-token",
      "sb-project-auth-token.0",
      "sb-project-auth-token.1",
      "sb-project-auth-token-code-verifier"
    ]
  );
  assert.deepEqual(authCookiesToClear(null), []);
  assert.deepEqual(authCookiesToClear(""), []);
  // A newline before "=" is surrounding whitespace, so the real name is still cleared.
  assert.deepEqual(authCookiesToClear("sb-project-auth-token\n=bad"), ["sb-project-auth-token"]);
  assert.deepEqual(authCookiesToClear("sb-project-auth-token"), ["sb-project-auth-token"]);
  assert.deepEqual(authCookiesToClear("sb-project-auth-token=a; sb-project-auth-token=b"), ["sb-project-auth-token"]);
  assert.deepEqual(authCookiesToClear("sb-project-auth-token\nbad=value"), []);
  assert.deepEqual(authCookiesToClear("sb-project-auth-token\r.0=chunk"), []);
  assert.deepEqual(authCookiesToClear("sb-project auth-token=1"), []);
  assert.deepEqual(authCookiesToClear("sb-project-auth-token\r\nSet-Cookie: evil=1"), []);

  const host = "endpointjobs.dev";
  assert.equal(signOutRequestAllowed(host, { origin: "https://endpointjobs.dev", site: "same-origin" }), true);
  assert.equal(signOutRequestAllowed(host, { origin: null, site: null }), true);
  assert.equal(signOutRequestAllowed(host, { origin: "https://evil.example", site: "cross-site" }), false);
  assert.equal(signOutRequestAllowed(host, { origin: "https://evil.example", site: null }), false);
  assert.equal(signOutRequestAllowed("localhost:3000", { origin: "https://endpointjobs.dev", site: "same-origin" }), false);

  const source = readFileSync(new URL("../../app/auth/sign-out/route.ts", import.meta.url), "utf8");
  assert.match(source, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.doesNotMatch(source, /signOut\(\s*\)/);
  assert.doesNotMatch(source, /getClaims/);
  assert.doesNotMatch(source, /\b503\b/);
  assert.match(source, /authCookiesToClear/);
  assert.match(source, /fetchWithAuthDeadline/);
  assert.match(source, /maxAge:\s*0/);
  assert.match(source, /httpOnly:\s*false/);
  assert.doesNotMatch(source, /secure/);
});

test("the account menu posts to the sign-out route so the document reloads", () => {
  const html = renderToStaticMarkup(createElement(AccountMenu, { email: "a@example.com" }));
  assert.match(html, /method="post"/);
  assert.match(html, /action="\/auth\/sign-out"/);
  assert.match(html, /Sign out/);
  assert.doesNotMatch(html, /action="\/"/);
});
