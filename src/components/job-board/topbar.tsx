import { MessageSquarePlus, MonitorSmartphone, RefreshCw } from "lucide-react";
import Link from "next/link";

import { formatUpdatedAt } from "@/lib/jobs";

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
        <a
          aria-label="Report an issue or request a feature on GitHub"
          className="feedback-link"
          href="https://github.com/jorgeasaurus/EndpointJobs/issues/new?template=report-or-request.yml"
          rel="noopener noreferrer"
          target="_blank"
          title="Report an issue or request a feature"
        >
          <MessageSquarePlus size={15} aria-hidden="true" />
          <span>Report / request</span>
        </a>
        <span className="refresh-pill">
          <RefreshCw size={15} aria-hidden="true" />
          {formatUpdatedAt(updatedAt)}
        </span>
      </div>
    </header>
  );
}

export function SiteFooter({ updatedAt }: { updatedAt: string }) {
  return (
    <footer className="site-footer">
      <span>Endpoint Jobs</span>
      <span>{formatUpdatedAt(updatedAt)}</span>
    </footer>
  );
}
