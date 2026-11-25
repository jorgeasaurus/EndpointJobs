import { statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const srcRoot = fileURLToPath(new URL("../../src/", import.meta.url));

/** A plain-anchor `next/link`, for harnesses that render links outside Next. */
export const nextLinkStub = new URL("./fixtures/stubs/next-link.tsx", import.meta.url);

/**
 * Bundles a browser harness into one script for Chrome. `@/` resolves to `src/`.
 * `stubs` maps a module id (`next/link`, `@/lib/supabase/client`) to the file that replaces it.
 */
export function bundleHarness(entry: URL, stubs: Record<string, URL> = {}) {
  return bundle(entry, stubs, "browser");
}

/** Bundles `entry` for Node with the same stubs and imports it, for server code such as route handlers. */
export async function importWithStubs<Module>(entry: URL, stubs: Record<string, URL>): Promise<Module> {
  const code = await bundle(entry, stubs, "node");
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

async function bundle(entry: URL, stubs: Record<string, URL>, platform: "browser" | "node") {
  const result = await esbuild.build({
    absWorkingDir: repoRoot,
    entryPoints: [fileURLToPath(entry)],
    bundle: true,
    write: false,
    format: platform === "browser" ? "iife" : "esm",
    platform,
    target: "es2022",
    jsx: "automatic",
    plugins: [
      {
        name: "harness-modules",
        setup(build) {
          build.onResolve({ filter: /^(?:@\/|\.|next\/)/ }, (args) => {
            const stub = stubs[moduleId(args.path, args.resolveDir)];
            if (stub) return { path: fileURLToPath(stub) };
            return args.path.startsWith("@/") ? { path: resolveSource(args.path) } : undefined;
          });
        }
      }
    ]
  });
  return result.outputFiles[0]?.text ?? "";
}

/** The `@/` id of a source import, so a relative and an aliased import stub alike. */
function moduleId(specifier: string, resolveDir: string) {
  if (!specifier.startsWith(".")) return specifier;
  const path = relative(srcRoot, resolve(resolveDir, specifier));
  return path.startsWith("..") ? specifier : `@/${path}`;
}

function resolveSource(id: string) {
  const base = resolve(srcRoot, id.slice(2));
  return [base, `${base}.tsx`, `${base}.ts`].find((path) => statSync(path, { throwIfNoEntry: false })?.isFile()) ?? base;
}
