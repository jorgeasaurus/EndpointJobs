import { getEndpointToolLabel, type EndpointTool } from "@/lib/job-taxonomy";

export { getCanonicalSeoIndex, getCanonicalSeoJobs } from "@/lib/canonical-jobs";
export { inferAddressCountry, isRichResultEligible, normalizeEmploymentType } from "@/lib/rich-result-schema";

export function getEndpointToolSeo(tool: EndpointTool) {
  const label = getEndpointToolLabel(tool);

  return {
    title: `${label} Jobs`,
    description: `Find daily refreshed ${label} jobs across endpoint engineering, MDM, UEM, and client platform roles.`
  };
}
