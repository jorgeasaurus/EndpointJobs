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

test("client and server source never reference the service role key", () => {
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false, file);
    assert.equal(source.includes("service_role"), false, file);
  }
});
