import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

test("names containing import or export still reach the client-prop check", () => {
  const root = mkdtempSync(resolve(tmpdir(), "landing-ast-"));
  try {
    writeFileSync(resolve(root, "card.tsx"), "\"use client\";\nexport function Card() { return null; }\nexport function exportCsv() { return null; }\n");
    writeFileSync(resolve(root, "dialogs.tsx"), "\"use client\";\nexport function ImportDialog() { return null; }\nexport function reexportJobs() { return null; }\n");
    writeFileSync(resolve(root, "listed.tsx"), "\"use client\";\nexport function Listed() { return null; }\n");
    writeFileSync(resolve(root, "lazy.tsx"), "\"use client\";\nexport default function Lazy() { return null; }\n");
    const source = [
      "import { exportCsv, Card } from \"./card\";",
      "import { ImportDialog, reexportJobs } from \"./dialogs\";",
      "export { Listed } from \"./listed\";",
      "const View = dynamic(() => import(\"./lazy\"));",
      "<Card board={board} />",
      "<ImportDialog board={board} />",
      "<reexportJobs board={board} />",
      "<Listed board={board} />"
    ].join("\n");
    const result = clientComponentsReceiving(source, resolve(root, "page.tsx"), "board");

    assert.equal(result.local, 4);
    assert.equal(result.resolved, 4);
    assert.equal(result.unresolved, "");
    assert.equal(result.dynamic, "./lazy");
    assert.equal(result.offenders, "Card,ImportDialog,reexportJobs,Listed,./lazy");
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
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);

  function note(specifier: string | null, imported: ParsedImport) {
    if (imported.kind === "dynamic") dynamic.push(specifier ?? "<non-literal>");
    if (specifier !== null && !specifier.startsWith("@/") && !specifier.startsWith(".")) return;
    if (specifier === null) {
      local += 1;
      unresolved.push("<non-literal>");
      return;
    }

    local += 1;
    const modulePath = resolveLocalModule(specifier, filePath);
    if (!modulePath) {
      unresolved.push(specifier);
      return;
    }
    resolved += 1;
    if (imported.kind === "type") return;

    const moduleSource = readFileSync(modulePath, "utf8");
    if (!/^["']use client["'];?/m.test(moduleSource)) return;
    if (imported.kind === "dynamic") {
      offenders.push(specifier);
      return;
    }

    for (const name of imported.names) {
      for (const tag of source.matchAll(new RegExp(`<${name}(\\s[^>]*)?>`, "g"))) {
        if (new RegExp(`\\b${prop}\\b`).test(tag[0])) offenders.push(name);
      }
    }
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      note(literalSpecifier(node.moduleSpecifier), namesFromImport(node));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      note(literalSpecifier(node.moduleSpecifier), namesFromExport(node));
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      note(argument ? literalSpecifier(argument) : null, { kind: "dynamic", names: [] });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {
    offenders: offenders.join(","),
    unresolved: unresolved.join(","),
    dynamic: dynamic.join(","),
    resolved,
    local
  };
}

type ParsedImport = { kind: "dynamic" | "type" | "value"; names: string[] };

function namesFromImport(node: ts.ImportDeclaration): ParsedImport {
  const clause = node.importClause;
  if (!clause) return { kind: "value", names: [] };
  if (clause.isTypeOnly) return { kind: "type", names: [] };

  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      if (!element.isTypeOnly) names.push(element.name.text);
    }
  }
  return { kind: "value", names };
}

function namesFromExport(node: ts.ExportDeclaration): ParsedImport {
  if (node.isTypeOnly) return { kind: "type", names: [] };
  const clause = node.exportClause;
  if (!clause) return { kind: "value", names: [] };
  if (ts.isNamespaceExport(clause)) return { kind: "value", names: [clause.name.text] };

  const names: string[] = [];
  for (const element of clause.elements) {
    if (!element.isTypeOnly) names.push(element.name.text);
  }
  return { kind: "value", names };
}

function literalSpecifier(expr: ts.Expression) {
  return ts.isStringLiteralLike(expr) ? expr.text : null;
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
