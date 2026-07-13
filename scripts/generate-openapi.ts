import { readFile, writeFile } from "node:fs/promises";

import { getJobsApiOpenApiParameters } from "../src/lib/jobs-api-contract";

const path = "public/openapi.json";
const specification = JSON.parse(await readFile(path, "utf8"));
specification.components.parameters = getJobsApiOpenApiParameters();
await writeFile(path, `${JSON.stringify(specification, null, 2)}\n`);
