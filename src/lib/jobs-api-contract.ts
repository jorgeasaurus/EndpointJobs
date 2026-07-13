import { minimumSalaryFilterValues } from "@/lib/job-filters";
import {
  platformOptions,
  roleFamilyOptions,
  seniorityOptions,
  toolOptions
} from "@/lib/jobs";

export type JobsApiQueryDefinition =
  | { kind: "text"; openApiName: string; minimumLength: number; maximumLength: number }
  | { kind: "multi"; openApiName: string; description: string; values: readonly string[] }
  | { kind: "enum"; openApiName: string; description?: string; values: readonly string[]; default?: string }
  | { kind: "integer"; openApiName: string; minimum: number; maximum?: number; default: number };

const minimumSalaryValues = minimumSalaryFilterValues.filter(
  (value) => value !== "Any"
);

export const jobsApiQueryContract = {
  q: { kind: "text", openApiName: "Query", minimumLength: 1, maximumLength: 200 },
  platforms: {
    kind: "multi",
    openApiName: "Platforms",
    description: "Comma-separated platform names.",
    values: platformOptions
  },
  tools: {
    kind: "multi",
    openApiName: "Tools",
    description: "Comma-separated endpoint tool names.",
    values: toolOptions
  },
  location: { kind: "text", openApiName: "Location", minimumLength: 1, maximumLength: 200 },
  workplace: {
    kind: "enum",
    openApiName: "Workplace",
    values: ["Remote", "Hybrid", "On-site"]
  },
  salary: {
    kind: "enum",
    openApiName: "SalaryShown",
    description: "Require disclosed salary.",
    values: ["1"]
  },
  minSalary: {
    kind: "enum",
    openApiName: "MinimumSalary",
    description: "Minimum USD salary floor; listings qualify when their salary ceiling meets it.",
    values: minimumSalaryValues
  },
  seniority: { kind: "enum", openApiName: "Seniority", values: seniorityOptions },
  family: { kind: "enum", openApiName: "RoleFamily", values: roleFamilyOptions },
  freshness: {
    kind: "enum",
    openApiName: "Freshness",
    description: "Maximum posted age in days.",
    values: ["7", "14", "30"]
  },
  sort: {
    kind: "enum",
    openApiName: "Sort",
    default: "newest",
    values: ["newest", "salary", "company"]
  },
  page: { kind: "integer", openApiName: "Page", minimum: 1, default: 1 },
  limit: { kind: "integer", openApiName: "Limit", minimum: 1, maximum: 100, default: 20 }
} as const satisfies Record<string, JobsApiQueryDefinition>;

export type JobsApiQueryKey = keyof typeof jobsApiQueryContract;

export function getJobsApiOpenApiParameters() {
  return Object.fromEntries(
    (Object.entries(jobsApiQueryContract) as [string, JobsApiQueryDefinition][]).map(([name, definition]) => [
      definition.openApiName,
      {
        name,
        in: "query",
        ...(definition.kind === "multi" ? { style: "form", explode: false } : {}),
        ...("description" in definition
          ? { description: definition.description }
          : {}),
        schema: toOpenApiSchema(definition)
      }
    ])
  );
}

function toOpenApiSchema(definition: JobsApiQueryDefinition) {
  if (definition.kind === "integer") {
    return {
      type: "integer",
      minimum: definition.minimum,
      ...(definition.maximum === undefined ? {} : { maximum: definition.maximum }),
      default: definition.default
    };
  }
  if (definition.kind === "text") {
    return {
      type: "string",
      minLength: definition.minimumLength,
      maxLength: definition.maximumLength
    };
  }
  if (definition.kind === "multi") {
    return {
      type: "array",
      items: { type: "string", enum: definition.values },
      example: definition.values.slice(0, 2)
    };
  }
  return {
    type: "string",
    ...(definition.values.length === 1
      ? { const: definition.values[0] }
      : { enum: definition.values }),
    ...(definition.default === undefined ? {} : { default: definition.default })
  };
}
