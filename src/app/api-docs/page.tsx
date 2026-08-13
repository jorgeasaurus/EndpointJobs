import type { Metadata } from "next";
import Link from "next/link";

import { ApiCodeBlock } from "@/components/api-code-block";
import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import {
  jobsApiQueryContract,
  type JobsApiQueryDefinition
} from "@/lib/jobs-api-contract";
import type { JobsFeed } from "@/types/job";

const feed = feedData as JobsFeed;

export const metadata: Metadata = {
  title: "Jobs API Documentation",
  description: "Query active endpoint engineering jobs with a public, read-only JSON API.",
  alternates: { canonical: "/api-docs" }
};

const curlExample = `curl 'https://endpointjobs.dev/api/jobs?tools=Jamf&platforms=macOS&limit=5'`;
const powershellExample = `$uri = 'https://endpointjobs.dev/api/jobs?workplace=Remote&minSalary=150000&limit=5'
$response = Invoke-RestMethod -Uri $uri
$response.data | Select-Object title, company, location, applyUrl`;
const javascriptExample = `const response = await fetch(
  'https://endpointjobs.dev/api/jobs?platforms=Windows&freshness=7&limit=5'
);
const { data, meta } = await response.json();
console.log(meta.total, data);`;
const responseExample = `{
  "data": [{ "id": "…", "title": "Endpoint Engineer", "company": "…" }],
  "filters": { "platforms": ["Windows"], "limit": 5 },
  "meta": { "page": 1, "limit": 5, "total": 42, "totalPages": 9 }
}`;

const queryParameters = Object.entries(jobsApiQueryContract) as [
  string,
  JobsApiQueryDefinition
][];

export default function ApiDocsPage() {
  return (
    <main className="site-frame api-docs-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />
        <article className="api-docs-page">
          <header className="api-docs-hero">
            <span className="section-kicker">Public, read-only API</span>
            <h1>Query endpoint roles from your own tools.</h1>
            <p>
              The API returns the same active, normalized listings as the job board.
              No authentication is required.
            </p>
            <nav aria-label="API resources">
              <a href="/openapi.json">OpenAPI specification</a>
              <a href="https://github.com/jorgeasaurus/EndpointJobs/blob/main/docs/api.md" rel="noopener noreferrer" target="_blank">
                Full reference
              </a>
              <Link href="/#open-roles">Browse jobs</Link>
            </nav>
          </header>

          <section className="api-endpoints" aria-labelledby="api-endpoints-heading">
            <div className="api-section-heading">
              <span className="section-kicker">Endpoints</span>
              <h2 id="api-endpoints-heading">Two read-only routes</h2>
            </div>
            <article>
              <code><strong>GET</strong> /api/jobs</code>
              <p>Filter and paginate the active job feed.</p>
            </article>
            <article>
              <code><strong>GET</strong> /api/jobs/&#123;id&#125;</code>
              <p>Retrieve one normalized listing by identifier.</p>
            </article>
          </section>

          <section className="api-docs-examples" aria-labelledby="api-examples-heading">
            <div>
              <span className="section-kicker">Quick start</span>
              <h2 id="api-examples-heading">Copy an example</h2>
              <p>Filter by platform, tool, workplace, salary, freshness, and more.</p>
            </div>
            <ApiCodeBlock code={curlExample} language="shell" title="curl request" />
            <ApiCodeBlock code={powershellExample} language="powershell" title="PowerShell request" />
            <ApiCodeBlock code={javascriptExample} language="javascript" title="JavaScript request" />
          </section>

          <section className="api-parameter-section" aria-labelledby="api-parameters-heading">
            <div className="api-section-heading">
              <span className="section-kicker">Contract</span>
              <h2 id="api-parameters-heading">Query parameters</h2>
              <p>Multi-value filters are comma-separated unless noted otherwise.</p>
            </div>
            <div className="api-table-scroll" role="region" aria-label="Jobs API query parameters" tabIndex={0}>
              <table>
                <thead>
                  <tr><th scope="col">Parameter</th><th scope="col">Type</th><th scope="col">Accepted values</th></tr>
                </thead>
                <tbody>
                  {queryParameters.map(([name, definition]) => (
                    <tr key={name}>
                      <th scope="row"><code>{name}</code></th>
                      <td>{definition.kind}</td>
                      <td>{formatQueryDefinition(definition)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="api-response-section" aria-labelledby="api-response-heading">
            <div className="api-section-heading">
              <span className="section-kicker">Response</span>
              <h2 id="api-response-heading">Stable envelope</h2>
              <p>Successful list requests return normalized records, applied filters, and pagination metadata.</p>
            </div>
            <ApiCodeBlock code={responseExample} language="json" title="Response shape" />
          </section>
        </article>
        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}

function formatQueryDefinition(definition: JobsApiQueryDefinition) {
  if (definition.kind === "text") {
    return `${definition.minimumLength}–${definition.maximumLength} characters`;
  }

  if (definition.kind === "integer") {
    const range = definition.maximum
      ? `${definition.minimum}–${definition.maximum}`
      : `${definition.minimum} or greater`;
    return `${range}; default ${definition.default}`;
  }

  const values = definition.values.join(", ");
  const defaultValue = "default" in definition && definition.default
    ? `; default ${definition.default}`
    : "";
  const separator = definition.kind === "multi" && definition.separator
    ? `; separated with “${definition.separator}”`
    : "";
  return `${values}${separator}${defaultValue}`;
}
