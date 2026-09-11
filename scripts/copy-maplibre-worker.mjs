import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.join(path.dirname(require.resolve("maplibre-gl/package.json")), "dist");
const destination = new URL("../public/maplibre/", import.meta.url);

mkdirSync(destination, { recursive: true });
// The ESM worker imports its shared module from the same directory.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, file), new URL(file, destination));
}
