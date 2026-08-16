import type { EndpointTool, Platform } from "@/types/job";
import { getEndpointToolLabel } from "@/lib/job-taxonomy";

// Adapted from Beautiful UI's Tool Chips primitive.
// https://www.beautifului.dev/#tool-chips
export function ToolChips({
  platforms,
  tools,
  variant = "compact",
  limit = 8
}: {
  platforms: readonly Platform[];
  tools: readonly EndpointTool[];
  variant?: "compact" | "grouped";
  limit?: number;
}) {
  if (platforms.length === 0 && tools.length === 0) return null;

  if (variant === "compact") {
    const visiblePlatforms = platforms.slice(0, limit);
    const visibleTools = tools.slice(0, Math.max(0, limit - visiblePlatforms.length));
    const hiddenCount = platforms.length + tools.length - visiblePlatforms.length - visibleTools.length;
    const hiddenTechnologyLabel = hiddenCount === 1 ? "technology" : "technologies";

    return (
      <div
        className="tag-row tool-chips"
        aria-label="Matched tools and platforms"
        role="group"
      >
        {visiblePlatforms.map((platform) => (
          <span
            aria-label={`Platform: ${platform}`}
            className="tool-chip tool-chip--platform"
            key={`platform-${platform}`}
          >
            {platform}
          </span>
        ))}
        {visibleTools.map((tool) => (
          <span
            aria-label={`Tool: ${getEndpointToolLabel(tool)}`}
            className="tool-chip tool-chip--tool"
            key={`tool-${tool}`}
          >
            {getEndpointToolLabel(tool)}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span
            aria-label={`${hiddenCount} additional ${hiddenTechnologyLabel}; open job details to view`}
            className="tool-chip tool-chip--more"
          >
            +{hiddenCount} more
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="tool-chip-groups">
      {platforms.length > 0 ? (
        <section>
          <h4>Platforms</h4>
          <div className="tool-chips">
            {platforms.map((platform) => (
              <span className="tool-chip tool-chip--platform" key={platform}>
                {platform}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {tools.length > 0 ? (
        <section>
          <h4>Tools</h4>
          <div className="tool-chips">
            {tools.map((tool) => (
              <span className="tool-chip tool-chip--tool" key={tool}>
                {getEndpointToolLabel(tool)}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
