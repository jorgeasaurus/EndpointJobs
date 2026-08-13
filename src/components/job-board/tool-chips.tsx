import type { EndpointTool, Platform } from "@/types/job";

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

    return (
      <div className="tag-row tool-chips" aria-label="Matched tools and platforms">
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
            aria-label={`Tool: ${tool}`}
            className="tool-chip tool-chip--tool"
            key={`tool-${tool}`}
          >
            {tool}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span
            aria-label={`${hiddenCount} additional technologies; open job details to view`}
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
          <h3>Platforms</h3>
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
          <h3>Tools</h3>
          <div className="tool-chips">
            {tools.map((tool) => (
              <span className="tool-chip tool-chip--tool" key={tool}>
                {tool}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
