import { readFile, writeFile } from "node:fs/promises";

import {
  getJobsApiOpenApiAppliedFilterEnums,
  getJobsApiOpenApiParameters
} from "../src/lib/jobs-api-contract";

const path = "public/openapi.json";
const specification = JSON.parse(await readFile(path, "utf8"));
specification.components.parameters = getJobsApiOpenApiParameters();
for (const [name, values] of Object.entries(getJobsApiOpenApiAppliedFilterEnums())) {
  specification.components.schemas.Filters.properties[name].enum = values;
}
await writeFile(path, `${JSON.stringify(specification, null, 2)}\n`);
