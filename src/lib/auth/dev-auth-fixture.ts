const fixtureEmail = "jorgesuarez@gmail.com";

export type DevAccountFixture = {
  savedIds: string[];
  viewedIds: string[];
  hideViewed: boolean;
  savedOnly: boolean;
};

type FixtureSession = {
  configured: boolean;
  email: string | null;
  userId?: string | null;
  /** The signed-in fixture's account data, read from the `e2e-*` params. */
  fixtureAccount?: DevAccountFixture;
};

/** Dev-only session stand-in for screenshots and harnesses. Production passes enabled=false. */
export function devAuthFixture(search: string, enabled: boolean): FixtureSession | null {
  if (!enabled) return null;
  const params = new URLSearchParams(search);
  const mode = params.get("e2e-auth");
  if (mode === "in") {
    const email = params.get("e2e-email")?.trim();
    return {
      configured: true,
      email: email || fixtureEmail,
      userId: "e2e-user",
      fixtureAccount: accountFixture(params)
    };
  }
  if (mode === "out") return { configured: true, email: null };
  if (mode === "off") return { configured: false, email: null };
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
