import type { Route } from "next";
import Link from "next/link";

import { AppreciateButton } from "@/components/appreciate-button";
import { formatUpdatedAt } from "@/lib/jobs";
import {
  appVersion,
  getApiDocsPath,
  getBoardPath,
  getJobsDirectoryPath,
  getRoadmapPath
} from "@/app/site-metadata";

type FooterLink =
  | { text: string; href: Route; label?: string }
  | { text: string; href: string; label: string; title: string; external: true };

const footerGroups: { id: string; label: string; links: FooterLink[] }[] = [
  {
    id: "browse",
    label: "Browse",
    links: [
      { text: "Job board", href: getBoardPath() },
      { text: "Job directory", href: getJobsDirectoryPath() },
      { text: "Roadmap", href: getRoadmapPath() },
      { text: "API docs", href: getApiDocsPath(), label: "Open API documentation" },
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
                    {group.links.map((link) => (
                      <li key={link.text}>
                        {"external" in link ? (
                          <a
                            aria-label={link.label}
                            className="footer-link"
                            href={link.href}
                            rel="noopener noreferrer"
                            target="_blank"
                            title={link.title}
                          >
                            {link.text}
                          </a>
                        ) : (
                          // Disable speculative prefetch to prevent stale page-one metadata during query pagination.
                          <Link aria-label={link.label} className="footer-link" href={link.href} prefetch={false}>
                            {link.text}
                          </Link>
                        )}
                      </li>
                    ))}
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
