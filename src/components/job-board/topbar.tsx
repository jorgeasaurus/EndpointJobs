import {
  Github,
  FileJson,
  MessageSquarePlus,
  MonitorSmartphone,
  Rows3,
  RefreshCw,
  SquareTerminal
} from "lucide-react";
import Link from "next/link";

import { formatUpdatedAt } from "@/lib/jobs";
import { getJobsDirectoryPath } from "@/app/site-metadata";

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
        <span className="refresh-pill">
          <RefreshCw size={15} aria-hidden="true" />
          {formatUpdatedAt(updatedAt)}
        </span>
        <a
          aria-label="Open API documentation on GitHub"
          className="feedback-link api-docs-link"
          href="https://github.com/jorgeasaurus/EndpointJobs/blob/main/docs/api.md"
          rel="noopener noreferrer"
          target="_blank"
          title="Open API documentation on GitHub"
        >
          <FileJson size={15} aria-hidden="true" />
          <span>API docs</span>
        </a>
        <a
          aria-label="Open PowerShell module documentation on GitHub"
          className="feedback-link powershell-docs-link"
          href="https://github.com/jorgeasaurus/EndpointJobs/blob/main/powershell/EndpointJobs/README.md"
          rel="noopener noreferrer"
          target="_blank"
          title="Open PowerShell module documentation on GitHub"
        >
          <SquareTerminal size={15} aria-hidden="true" />
          <span>PowerShell</span>
        </a>
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
      </div>
    </header>
  );
}

export function SiteFooter({ updatedAt }: { updatedAt: string }) {
  return (
    <footer className="site-footer">
      <div className="footer-bottom">
        <div className="footer-meta">
          <span>Made by Jorgeasaurus</span>
          <span>{formatUpdatedAt(updatedAt)}</span>
        </div>

        <nav className="footer-links" aria-label="Project links">
          <Link className="feedback-link footer-link" href={getJobsDirectoryPath()}>
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
