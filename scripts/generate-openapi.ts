import { readFile, writeFile } from "node:fs/promises";

import {
  getJobsApiOpenApiAppliedFiltersSchema,
  getJobsApiOpenApiParameters
} from "../src/lib/jobs-api-contract";

const path = "public/openapi.json";
const specification = JSON.parse(await readFile(path, "utf8"));
specification.components.parameters = getJobsApiOpenApiParameters();
specification.paths["/api/jobs"].get.parameters = Object.keys(
  specification.components.parameters
).map((name) => ({ $ref: `#/components/parameters/${name}` }));
specification.components.schemas.Filters = getJobsApiOpenApiAppliedFiltersSchema();
await writeFile(path, `${JSON.stringify(specification, null, 2)}\n`);
