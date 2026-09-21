import { readFile, writeFile } from "node:fs/promises";

import {
  getJobsApiOpenApiAppliedFiltersSchema,
  getJobsApiOpenApiParameters
} from "../src/lib/jobs-api-contract";

import { sponsorshipStatuses } from "../src/lib/visa-sponsorship";

import { endpointToolNameMap } from "../src/lib/job-taxonomy";

const path = "public/openapi.json";
const specification = JSON.parse(await readFile(path, "utf8"));
specification.components.parameters = getJobsApiOpenApiParameters();
specification.paths["/api/jobs"].get.parameters = Object.keys(
  specification.components.parameters
).map((name) => ({ $ref: `#/components/parameters/${name}` }));
specification.components.schemas.Filters = getJobsApiOpenApiAppliedFiltersSchema();
specification.components.schemas.Job.properties.visaSponsorship = {
  type: "object",
  description: "Sponsorship statement extracted from the listing; absence means not stated.",
  oneOf: [
    {
      required: ["status"],
      properties: { status: { const: "not-stated" } },
      additionalProperties: false
    },
    {
      required: ["status", "evidence", "sourceUrl"],
      properties: {
        status: { type: "string", enum: sponsorshipStatuses.filter((status) => status !== "not-stated") },
        evidence: { type: "string", minLength: 1, description: "Supporting excerpt from the listing." },
        sourceUrl: { type: "string", minLength: 1, format: "uri" }
      },
      additionalProperties: false
    }
  ]
};
await writeFile(path, `${JSON.stringify(specification, null, 2)}\n`);

await writeFile(
  "powershell/EndpointJobs/EndpointTools.json",
  `${JSON.stringify(endpointToolNameMap, null, 2)}\n`
);
