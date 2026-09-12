import assert from "node:assert/strict";
import test from "node:test";
import { deriveTools, isEndpointRelevant, normalizeSearchText } from "../job-refresh/shared";

function matches(title: string, description: string) {
  const text = normalizeSearchText(`${title} ${description}`);
  return isEndpointRelevant(text, title, deriveTools(text));
}

test("IT platform and lead specialist roles require endpoint responsibilities", () => {
  assert.equal(matches("Senior IT Platform and Automation Engineer", "Own Jamf and Intune device lifecycle, zero-touch onboarding and endpoint patch compliance."), true);
  assert.equal(matches("Lead IT Specialist", "Manage Kandji for Mac and Intune for Windows, encryption and OS updates."), true);
  assert.equal(matches("Staff IT Systems Engineer", "Own Endpoint Engineering and Digital Workplace; execute device management across macOS, Windows, and mobile platforms."), true);
  assert.equal(matches("Senior IT Platform and Automation Engineer", "Build finance workflow integrations and business reporting."), false);
  assert.equal(matches("Lead IT Specialist", "Maintain ERP accounting and procurement workflows."), false);
  assert.equal(matches("IT Service Desk Engineer", "Tier 2 support for Jamf and Intune devices."), false);
  assert.equal(matches("Software Engineer", "Build endpoint product integrations with Intune."), false);
});

test("trading systems scripting does not imply employee endpoint ownership", () => {
  for (const title of ["Options Trading Systems Engineer", "Trade Systems Engineer", "Trading Systems Engineer (Event Driven Trading)"]) {
    assert.equal(matches(title, "Support low latency trading infrastructure with Python, Bash and PowerShell."), false);
  }
  assert.equal(matches("Endpoint Engineer - Trading Systems", "Manage Windows desktops with Intune."), true);
});
