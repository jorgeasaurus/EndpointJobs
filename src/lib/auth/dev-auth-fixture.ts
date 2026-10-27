const fixtureEmail = "jorgesuarez@gmail.com";

type FixtureSession = {
  configured: boolean;
  email: string | null;
};

/** Dev-only session stand-in for screenshots and harnesses. Production passes enabled=false. */
export function devAuthFixture(search: string, enabled: boolean): FixtureSession | null {
  if (!enabled) return null;
  const params = new URLSearchParams(search);
  const mode = params.get("e2e-auth");
  if (mode === "in") {
    const email = params.get("e2e-email")?.trim();
    return { configured: true, email: email || fixtureEmail };
  }
  if (mode === "out") return { configured: true, email: null };
  if (mode === "off") return { configured: false, email: null };
  return null;
}
