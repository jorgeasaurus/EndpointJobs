import assert from "node:assert/strict";
import test from "node:test";

import { schoolJobsProvider } from "../job-refresh/providers/schooljobs";

const rss = `<?xml version="1.0" encoding="utf-8"?>
<rss xmlns:joblisting="https://www.schooljobs.com" version="2.0">
  <channel>
    <title>Tacoma Public Schools (WA), WA</title>
    <item>
      <guid isPermaLink="true">https://www.schooljobs.com/careers/TacomaPublicSchools/jobs/5409269</guid>
      <link>https://www.schooljobs.com/careers/TacomaPublicSchools/jobs/5409269</link>
      <title>Endpoint Management and Automation Specialist</title>
      <description><![CDATA[<p>Salary Level: $103,855 - $143,503</p>]]></description>
      <pubDate>Tue, 14 Jul 2026 18:39:04 GMT</pubDate>
      <joblisting:jobId>5409269</joblisting:jobId>
      <joblisting:advertiseFromDateUTC>Tue, 14 Jul 2026 08:00:00:0</joblisting:advertiseFromDateUTC>
      <joblisting:advertiseToDateTimeUTC>Wed, 22 Jul 2026 07:59:00:0</joblisting:advertiseToDateTimeUTC>
      <joblisting:jobType>Full time</joblisting:jobType>
      <joblisting:department>Technology Services</joblisting:department>
      <joblisting:examplesofduties><![CDATA[Manage enterprise endpoint systems, software packaging, Windows images, Intune, and Group Policy. Develop and maintain automated deployment processes, task sequences, security updates, workstation images, application compatibility testing, and client lifecycle documentation. Troubleshoot endpoint management platforms and collaborate with field technicians to deliver reliable device services across the district.]]></joblisting:examplesofduties>
      <joblisting:qualifications><![CDATA[Experience with PowerShell scripting and Active Directory.]]></joblisting:qualifications>
      <joblisting:location>Foss High 2112 S. Tyler St.</joblisting:location>
      <joblisting:categories><joblisting:category><Category>IT and Computers</Category></joblisting:category></joblisting:categories>
    </item>
    <item>
      <link>https://www.schooljobs.com/careers/TacomaPublicSchools/jobs/123</link>
      <title>Assistant Football Coach</title>
      <description>Coach the high school football team.</description>
      <joblisting:jobId>123</joblisting:jobId>
    </item>
  </channel>
</rss>`;

test("SchoolJobs normalizes relevant RSS jobs and rejects unrelated listings", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(rss, {
    status: 200,
    headers: { "content-type": "text/xml" }
  });

  let jobs;
  try {
    jobs = await schoolJobsProvider.fetchJobs({
      url: schoolJobsProvider.defaultUrl,
      fetchedAt: new Date("2026-07-15T12:00:00.000Z")
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(jobs.length, 2);
  const job = jobs[0];
  assert.ok(job);
  assert.equal(jobs[1], null);
  assert.equal(job.company, "Tacoma Public Schools");
  assert.equal(job.postedAt, "2026-07-14T08:00:00.000Z");
  assert.equal(job.expiresAt, "2026-07-22T07:59:00.000Z");
  assert.equal(job.staleAfter, job.expiresAt);
  assert.equal(job.source, "SchoolJobs");
  assert.equal(job.termsProfile, "public-api");
  assert.equal(job.employmentType, "Full time");
  assert.match(job.description ?? "", /PowerShell scripting/);
  assert.ok(job.tags.includes("Technology Services"));
  assert.ok(job.tools.includes("Intune"));
});

test("SchoolJobs reports HTTP failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", {
    status: 503,
    statusText: "Service Unavailable"
  });

  try {
    await assert.rejects(
      schoolJobsProvider.fetchJobs({
        url: schoolJobsProvider.defaultUrl,
        fetchedAt: new Date("2026-07-15T12:00:00.000Z")
      }),
      /503 Service Unavailable/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
