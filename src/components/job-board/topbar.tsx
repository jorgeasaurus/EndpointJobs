import {
  Coffee,
  Github,
  FileJson,
  MessageSquarePlus,
  MonitorSmartphone,
  Rows3,
  Search,
  RefreshCw,
  Route,
  Shield,
  SquareTerminal
} from "lucide-react";
import Link from "next/link";

import { AppreciateButton } from "@/components/appreciate-button";
import { AuthMenu } from "@/components/auth/auth-menu";
import { formatUpdatedAt } from "@/lib/jobs";
import {
  appVersion,
  getApiDocsPath,
  getBoardPath,
  getJobsDirectoryPath,
  getMcpDocsPath,
  getRoadmapPath
} from "@/app/site-metadata";

import { TopbarOverflow } from "./topbar-overflow";

export function Topbar({ updatedAt }: { updatedAt: string }) {
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
        <span className="refresh-pill">
          <RefreshCw size={15} aria-hidden="true" />
          {formatUpdatedAt(updatedAt)}
        </span>
        <TopbarOverflow>
          <Link
            aria-label="Open API documentation"
            className="feedback-link api-docs-link"
            href={getApiDocsPath()}
            prefetch={false}
            title="Open API documentation"
          >
            <FileJson size={15} aria-hidden="true" />
            <span>API docs</span>
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
          <Link
            aria-label="Learning roadmap"
            className="feedback-link roadmap-link"
            href={getRoadmapPath()}
            prefetch={false}
            title="Endpoint engineering learning roadmap"
          >
            <Route size={15} aria-hidden="true" />
            <span>Roadmap</span>
          </Link>
          <a
            aria-label="Open feedback form on GitHub"
            className="feedback-link topbar-feedback-link"
            href="https://github.com/jorgeasaurus/EndpointJobs/issues/new?template=report-or-request.yml"
            rel="noopener noreferrer"
            target="_blank"
            title="Report an issue or request a feature"
          >
            <MessageSquarePlus size={15} aria-hidden="true" />
            <span>Feedback</span>
          </a>
          <a
            aria-label="Support the board on Buy Me a Coffee"
            className="feedback-link support-link"
            href="https://buymeacoffee.com/jorgeasaurus"
            rel="noopener noreferrer"
            target="_blank"
            title="Support the board"
          >
            <Coffee size={15} aria-hidden="true" />
            <span>Support the board</span>
          </a>
        </TopbarOverflow>
      </div>
    </header>
  );
}

export function SiteFooter({ updatedAt }: { updatedAt: string }) {
  return (
    <footer className="site-footer">
      <AppreciateButton />
      <div className="footer-bottom">
        <div className="footer-meta">
          <span>Made by Jorgeasaurus</span>
          <span>v{appVersion}</span>
          <span>{formatUpdatedAt(updatedAt)}</span>
        </div>

        <nav className="footer-links" aria-label="Project links">
          <a
            aria-label="Open PowerShell module documentation on GitHub"
            className="feedback-link footer-link"
            href="https://github.com/jorgeasaurus/EndpointJobs/blob/main/powershell/EndpointJobs/README.md"
            rel="noopener noreferrer"
            target="_blank"
            title="Open PowerShell module documentation on GitHub"
          >
            <SquareTerminal size={15} aria-hidden="true" /><span>PowerShell</span>
          </a>
          <Link className="feedback-link footer-link" href={getBoardPath()} prefetch={false}>
            <Search size={15} aria-hidden="true" />
            <span>Job board</span>
          </Link>
          {/* Disable speculative prefetch to prevent stale page-one metadata during query pagination. */}
          <Link className="feedback-link footer-link" href={getJobsDirectoryPath()} prefetch={false}>
            <Rows3 size={15} aria-hidden="true" />
            <span>All jobs</span>
          </Link>
          <a
            aria-label="Report an issue or request a feature on GitHub"
            className="feedback-link footer-link"
            href="https://github.com/jorgeasaurus/EndpointJobs/issues/new?template=report-or-request.yml"
            rel="noopener noreferrer"
            target="_blank"
            title="Report an issue or request a feature"
          >
            <MessageSquarePlus size={15} aria-hidden="true" />
            <span>Report / request</span>
          </a>
          <Link className="feedback-link footer-link" href={getRoadmapPath()} prefetch={false}>
            <Route size={15} aria-hidden="true" />
            <span>Roadmap</span>
          </Link>
          <Link className="feedback-link footer-link" href="/privacy">
            <Shield size={15} aria-hidden="true" />
            <span>Privacy</span>
          </Link>
          <a
            aria-label="Open the Endpoint Jobs GitHub repository"
            className="feedback-link footer-link"
            href="https://github.com/jorgeasaurus/EndpointJobs"
            rel="noopener noreferrer"
            target="_blank"
            title="Open GitHub repository"
          >
            <Github size={15} aria-hidden="true" />
            <span>GitHub repo</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
