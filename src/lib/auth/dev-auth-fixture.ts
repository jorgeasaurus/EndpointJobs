import { noAccount, type DevAccountFixture, type SignInSession } from "./session";

const fixtureEmail = "jorgesuarez@gmail.com";

/** Dev-only session stand-in for screenshots and harnesses. Production passes enabled=false. */
export function devAuthFixture(search: string, enabled: boolean): SignInSession | null {
  if (!enabled) return null;
  const params = new URLSearchParams(search);
  const mode = params.get("e2e-auth");
  if (mode === "in") {
    const email = params.get("e2e-email")?.trim();
    return {
      configured: true,
      account: { kind: "fixture", userId: "e2e-user", email: email || fixtureEmail, fixture: accountFixture(params) }
    };
  }
  if (mode === "out") return { configured: true, account: noAccount };
  if (mode === "off") return { configured: false, account: noAccount };
  return null;
}

/** Only the `e2e-*` params count, so `savedOnly=1` in a shared URL is ignored. */
function accountFixture(params: URLSearchParams): DevAccountFixture {
  return {
    savedIds: splitFixtureIds(params.get("e2e-saved")),
    viewedIds: splitFixtureIds(params.get("e2e-viewed")),
    hideViewed: params.get("e2e-hide-viewed") === "1",
    savedOnly: params.get("e2e-saved-only") === "1"
  };
}

function splitFixtureIds(value: string | null) {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
