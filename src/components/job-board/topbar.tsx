import {
  MonitorSmartphone,
  Route,
  SquareTerminal
} from "lucide-react";
import Link from "next/link";

import { AuthMenu } from "@/components/auth/auth-menu";
import { formatUpdatedAt } from "@/lib/jobs";
import { getMcpDocsPath, getRoadmapPath } from "@/app/site-metadata";

import { TopbarOverflow } from "./topbar-overflow";

/** Omit `updatedAt` on pages that already show the feed's freshness. */
export function Topbar({ updatedAt }: { updatedAt?: string }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Endpoint Jobs home">
        <span className="brand-mark">
          <MonitorSmartphone size={18} aria-hidden="true" />
        </span>
        <span>Endpoint Jobs</span>
      </Link>

      <div className="topbar-actions">
        <AuthMenu />
        {updatedAt ? (
          <span className="refresh-pill">
            <span className="refresh-label">Updated</span> {formatUpdatedAt(updatedAt)}
          </span>
        ) : null}
        <TopbarOverflow>
          <Link
            aria-label="Learning roadmap"
            className="feedback-link roadmap-link"
            href={getRoadmapPath()}
            prefetch={false}
            title="Endpoint engineering learning roadmap"
          >
            <Route size={15} aria-hidden="true" />
            <span>Learning roadmap</span>
          </Link>
          <Link
            aria-label="MCP guide"
            className="feedback-link mcp-docs-link"
            href={getMcpDocsPath()}
            prefetch={false}
            title="Open MCP setup guide"
          >
            <SquareTerminal size={15} aria-hidden="true" />
            <span>MCP guide</span>
          </Link>
        </TopbarOverflow>
      </div>
    </header>
  );
}
