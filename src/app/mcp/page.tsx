import type { Metadata } from "next";
import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import { McpGuide } from "@/components/mcp-guide";
import feedData from "@/data/jobs.json";
import "../api-docs/api-docs.css";
import "./mcp.css";

export const metadata: Metadata = {
  title: "MCP Setup & Instructions",
  description: "Connect your AI assistant to Endpoint Jobs. Human setup guidance and copyable agent instructions for the public MCP server.",
  alternates: { canonical: "/mcp" }
};

export default function McpPage() {
  return (
    <main className="site-frame api-docs-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={feedData.updatedAt} />
        <McpGuide />
        <SiteFooter updatedAt={feedData.updatedAt} />
      </div>
    </main>
  );
}
