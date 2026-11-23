import {
  MonitorSmartphone,
  Route,
  SquareTerminal
} from "lucide-react";
import type { Route as AppRoute } from "next";
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

type FooterLink =
  | { text: string; href: AppRoute; label?: string; className?: string }
  | { text: string; href: string; label: string; title: string; className?: string; external: true };

const footerGroups: { id: string; label: string; links: FooterLink[] }[] = [
  {
    id: "browse",
    label: "Browse",
    links: [
      { text: "Job board", href: getBoardPath() },
      { text: "Job directory", href: getJobsDirectoryPath() },
      { text: "Roadmap", href: getRoadmapPath() },
      { text: "API docs", href: getApiDocsPath(), label: "Open API documentation", className: "api-docs-link" },
      { text: "Privacy", href: "/privacy" }
    ]
  },
  {
    id: "project",
    label: "Project",
    links: [
      {
        text: "PowerShell",
        href: "https://github.com/jorgeasaurus/EndpointJobs/blob/main/powershell/EndpointJobs/README.md",
        label: "Open PowerShell module documentation on GitHub",
        title: "Open PowerShell module documentation on GitHub",
        external: true
      },
      {
        text: "Report / request",
        href: "https://github.com/jorgeasaurus/EndpointJobs/issues/new?template=report-or-request.yml",
        label: "Report an issue or request a feature on GitHub",
        title: "Report an issue or request a feature",
        external: true
      },
      {
        text: "Support the board",
        href: "https://buymeacoffee.com/jorgeasaurus",
        label: "Support the board on Buy Me a Coffee",
        title: "Support the board",
        className: "support-link",
        external: true
      },
      {
        text: "GitHub repo",
        href: "https://github.com/jorgeasaurus/EndpointJobs",
        label: "Open the Endpoint Jobs GitHub repository",
        title: "Open GitHub repository",
        external: true
      }
    ]
  }
];

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
          <div className="footer-groups">
            {footerGroups.map((group) => {
              const labelId = `footer-group-${group.id}`;
              return (
                <div className="footer-link-group" key={group.id}>
                  <span className="footer-group-label" id={labelId}>{group.label}</span>
                  <ul className="footer-link-list" aria-labelledby={labelId}>
                    {group.links.map((link) => {
                      const className = link.className ? `footer-link ${link.className}` : "footer-link";
                      return (
                        <li key={link.text}>
                          {"external" in link ? (
                            <a
                              aria-label={link.label}
                              className={className}
                              href={link.href}
                              rel="noopener noreferrer"
                              target="_blank"
                              title={link.title}
                            >
                              {link.text}
                            </a>
                          ) : (
                            // Disable speculative prefetch to prevent stale page-one metadata during query pagination.
                            <Link aria-label={link.label} className={className} href={link.href} prefetch={false}>
                              {link.text}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>
      </div>
    </footer>
  );
}
