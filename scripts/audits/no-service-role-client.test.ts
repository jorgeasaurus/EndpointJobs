import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = path.join(directory, name);
    if (statSync(fullPath).isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|tsx|js|mjs|css)$/.test(fullPath) ? [fullPath] : [];
  });
}

const adminClient = "src/lib/supabase/admin.ts";
const deleteRoute = "src/app/api/account/delete/route.ts";

test("the service role key stays in the server-only admin client", () => {
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    const mentionsKey = source.includes("SUPABASE_SERVICE_ROLE_KEY");
    const mentionsRole = source.includes("service_role");
    if (file === adminClient) {
      assert.equal(mentionsKey, true);
      assert.equal(mentionsRole, false);
      assert.match(source, /import "server-only"/);
      assert.equal(source.includes("use client"), false);
      continue;
    }
    assert.equal(mentionsKey, false, file);
    assert.equal(mentionsRole, false, file);
    if (file === deleteRoute) continue;
    assert.equal(source.includes("createAdminClient"), false, file);
    assert.equal(source.includes("supabase/admin"), false, file);
  }
});
