import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { preProcessFile } from "typescript";

import { initialFilterState } from "../../src/components/job-board/filter-model";
import { getLandingJsonLd, serializeJsonLd } from "../../src/app/structured-data";
import { queryBoardPage } from "../../src/lib/board-page";
import { boardHomeRedirectKeys, filterSearchParamKeys } from "../../src/lib/board-search-params";
import { legacyHomeBoardRedirect } from "../../src/lib/legacy-board-url";
import { getJobWorkplace } from "../../src/lib/workplace";
import { assertPrerenderedHomeHtml, prerenderedHomeHtmlPath } from "./home-html-size";
import { makeJob } from "./shared";

const homePath = fileURLToPath(new URL("../../src/app/page.tsx", import.meta.url));
const srcRoot = fileURLToPath(new URL("../../src/", import.meta.url));
const home = readFileSync(homePath, "utf8");
const board = readFileSync(new URL("../../src/app/board/page.tsx", import.meta.url), "utf8");

test("the home page is a landing page with a privacy link and an account reason", () => {
  assert.match(home, /See the jobs/);
  assert.match(home, /href=\{getBoardPath\(\)\}/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /Why an account/);
  assert.match(home, /jobs you save/i);
  assert.match(home, /filters you choose to keep/i);
  assert.match(home, /which listings you have opened/i);
  assert.match(home, /An account is optional/);
  assert.match(home, /export const revalidate = 3600/);
  assert.match(home, /\.slice\(0, 4\)/);
  assert.match(home, /label: "Open roles", value: board\.total/);
  assert.match(home, /label: "Remote or hybrid", value: board\.metrics\.remoteJobsCount/);
  assert.doesNotMatch(home, /label: "Remote",/);
  assert.doesNotMatch(home, /trackedJobsCount/);
  assert.doesNotMatch(home, /<JobBoard/);
  assert.doesNotMatch(home, /board\.jobs\b(?!\.slice)/);
  const clientProps = clientComponentsReceiving(home, homePath, "board");
  assert.equal(
    clientProps.resolved,
    clientProps.local,
    `unresolved local imports: ${clientProps.unresolved}`
  );
  assert.ok(clientProps.local > 0, "home page imports were not resolved");
  assert.equal(clientProps.dynamic, "");
  assert.equal(clientProps.offenders, "");
  assert.match(board, /<JobBoard initialPage=\{initialPage\} \/>/);
  assert.match(board, /export const revalidate = 3600/);
});

test("an unresolved local import fails the client-prop guard", () => {
  const source = [
    'import { Widget } from "@/components/does-not-exist";',
    'import Link from "next/link";',
    'import { getJobWorkplace } from "@/lib/workplace";',
    "import helper from './moved-module.mjs'",
    'export { Other } from "@/components/also-missing"',
    'const View = dynamic(() => import("@/components/dynamic-missing"))'
  ].join("\n");
  const result = clientComponentsReceiving(source, homePath, "board");

  assert.equal(result.local, 5);
  assert.equal(result.resolved, 1);
  assert.equal(
    result.unresolved,
    "@/components/does-not-exist,./moved-module.mjs,@/components/also-missing,@/components/dynamic-missing"
  );
  assert.equal(result.dynamic, "@/components/dynamic-missing");
  assert.equal(result.offenders, "");
});

test("a directory import reads index.ts instead of throwing", () => {
  const root = mkdtempSync(resolve(tmpdir(), "landing-barrel-"));
  try {
    const barrel = resolve(root, "barrel");
    const empty = resolve(root, "empty");
    mkdirSync(barrel);
    mkdirSync(empty);
    writeFileSync(resolve(barrel, "index.ts"), "\"use client\";\nexport function Barrel() { return null; }\n");
    const source = [
      "import { Barrel } from \"./barrel\";",
      "import { Empty } from \"./empty\";",
      "<Barrel board={board} />"
    ].join("\n");
    const result = clientComponentsReceiving(source, resolve(root, "page.tsx"), "board");

    assert.equal(result.local, 2);
    assert.equal(result.resolved, 1);
    assert.equal(result.unresolved, "./empty");
    assert.equal(result.dynamic, "");
    assert.equal(result.offenders, "Barrel");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the remote metric includes hybrid roles on the same jobs as the open-role total", () => {
  const page = queryBoardPage({
    updatedAt: "2026-10-26T00:00:00.000Z",
    source: { name: "Audit", url: "https://example.com/audit" },
    jobs: [
      makeJob({
        id: "remote-role",
        title: "Remote endpoint engineer",
        company: "Remote Co",
        workplace: "Remote",
        sourceUrl: "https://example.com/remote-role",
        applyUrl: "https://example.com/remote-role/apply"
      }),
      makeJob({
        id: "hybrid-role",
        title: "Hybrid endpoint engineer",
        company: "Hybrid Co",
        location: "Seattle, WA",
        workplace: "Hybrid",
        sourceUrl: "https://example.com/hybrid-role",
        applyUrl: "https://example.com/hybrid-role/apply"
      }),
      makeJob({
        id: "onsite-role",
        title: "Onsite endpoint engineer",
        company: "Onsite Co",
        location: "Austin, TX",
        workplace: "On-site",
        sourceUrl: "https://example.com/onsite-role",
        applyUrl: "https://example.com/onsite-role/apply"
      })
    ]
  }, initialFilterState, 1);
  const remoteOnly = page.jobs.filter((job) => getJobWorkplace(job) === "Remote").length;

  assert.equal(page.total, 3);
  assert.equal(page.metrics.remoteJobsCount, 2);
  assert.ok(page.metrics.remoteJobsCount > remoteOnly);
  assert.ok(page.metrics.salaryJobsCount <= page.total);
});

test(
  "prerendered home HTML stays under 100 KB",
  { skip: existsSync(prerenderedHomeHtmlPath) ? false : "run next build, then npm run audit:html-size" },
  () => {
    assertPrerenderedHomeHtml(readFileSync(prerenderedHomeHtmlPath));
  }
);

test("landing JSON-LD describes the site without embedding listings", () => {
  const serialized = serializeJsonLd(getLandingJsonLd());
  assert.match(serialized, /WebSite/);
  assert.match(serialized, /WebApplication/);
  assert.match(serialized, /endpoint engineering jobs/i);
  assert.match(serialized, /\/board\?q=/);
  assert.doesNotMatch(serialized, /ItemList/);
  assert.doesNotMatch(serialized, /CollectionPage/);
});

test("filtered home URLs redirect to the job board and plain visits stay put", () => {
  const filtered = legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/?q=Intune&utm_source=share"));
  assert.equal(filtered?.pathname, "/board");
  assert.equal(filtered?.searchParams.get("q"), "Intune");
  assert.equal(filtered?.searchParams.get("utm_source"), "share");

  const paged = legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/?page=2"));
  assert.equal(paged?.pathname, "/board");
  assert.equal(paged?.searchParams.get("page"), "2");

  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/")), null);
  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/?utm_source=google")), null);
  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/jobs?page=2")), null);
  assert.equal(legacyHomeBoardRedirect(new URL("https://endpointjobs.dev/board?q=Jamf")), null);
});

test("a new board search key redirects because the home redirect reads one key set", () => {
  const legacy = readFileSync(new URL("../../src/lib/legacy-board-url.ts", import.meta.url), "utf8");
  const keys = readFileSync(new URL("../../src/lib/board-search-params.ts", import.meta.url), "utf8");
  const proxy = readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8");

  assert.match(legacy, /boardHomeRedirectKeys/);
  assert.doesNotMatch(legacy, /minSalary/);
  assert.doesNotMatch(keys, /^\s*import /m);
  assert.doesNotMatch(proxy, /filter-url/);
  assert.deepEqual(
    [...boardHomeRedirectKeys].sort(),
    [...filterSearchParamKeys, "page"].sort()
  );

  for (const key of boardHomeRedirectKeys) {
    const redirected = legacyHomeBoardRedirect(new URL(`https://endpointjobs.dev/?${key}=1`));
    assert.equal(redirected?.pathname, "/board", key);
    assert.equal(redirected?.searchParams.get(key), "1");
  }
});

function clientComponentsReceiving(source: string, filePath: string, prop: string) {
  const offenders: string[] = [];
  const unresolved: string[] = [];
  const dynamic: string[] = [];
  let local = 0;
  let resolved = 0;

  for (const ref of preProcessFile(source).importedFiles) {
    const specifier = ref.fileName;
    const imported = classifyImport(source, ref.pos);
    if (imported.kind === "dynamic") dynamic.push(specifier);
    if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;

    local += 1;
    const modulePath = resolveLocalModule(specifier, filePath);
    if (!modulePath) {
      unresolved.push(specifier);
      continue;
    }
    resolved += 1;
    if (imported.kind === "type") continue;

    const moduleSource = readFileSync(modulePath, "utf8");
    if (!/^["']use client["'];?/m.test(moduleSource)) continue;
    if (imported.kind === "dynamic") {
      offenders.push(specifier);
      continue;
    }

    for (const name of imported.names) {
      for (const tag of source.matchAll(new RegExp(`<${name}(\\s[^>]*)?>`, "g"))) {
        if (new RegExp(`\\b${prop}\\b`).test(tag[0])) offenders.push(name);
      }
    }
  }

  return {
    offenders: offenders.join(","),
    unresolved: unresolved.join(","),
    dynamic: dynamic.join(","),
    resolved,
    local
  };
}

function classifyImport(source: string, pos: number) {
  const before = source.slice(0, pos);
  if (/import\s*\(\s*$/.test(before)) return { kind: "dynamic" as const, names: [] as string[] };

  const keywordAt = Math.max(before.lastIndexOf("import"), before.lastIndexOf("export"));
  if (keywordAt < 0) return { kind: "value" as const, names: [] as string[] };

  let body = before.slice(keywordAt).replace(/^(?:import|export)\s*/, "");
  if (/^type\b/.test(body)) return { kind: "type" as const, names: [] as string[] };
  body = body.replace(/\s*from\s*$/, "").trim();
  if (!body || body === "*") return { kind: "value" as const, names: [] as string[] };
  return { kind: "value" as const, names: importedNames(body) };
}

function importedNames(clause: string) {
  const names: string[] = [];
  const named = clause.match(/\{([\s\S]*)\}/);

  if (named) {
    for (const part of named[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith("type ")) continue;
      const alias = trimmed.split(/\s+as\s+/).pop()?.trim();
      if (alias) names.push(alias);
    }
  }

  const binding = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
  const alias = binding.split(/\s+as\s+/).pop()?.trim();
  if (alias && alias !== "*") names.push(alias);
  return names;
}

function resolveLocalModule(specifier: string, fromFile: string) {
  const base = specifier.startsWith("@/")
    ? resolve(srcRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) return null;

  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    resolve(base, "index.tsx"),
    resolve(base, "index.ts")
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
}
