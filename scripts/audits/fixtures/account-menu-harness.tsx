import { createRoot } from "react-dom/client";

import { AccountMenu } from "../../../src/components/auth/account-menu";

const root = document.getElementById("root");
const email = document.body.dataset.email ?? "jorgesuarez@gmail.com";
if (!root) throw new Error("missing account menu harness root");

createRoot(root).render(
  <div className="site-frame">
    <header className="topbar">
      <a className="brand" href="#home">Endpoint Jobs</a>
      <div className="topbar-actions">
        <AccountMenu email={email} />
        <a className="feedback-link api-docs-link" href="#api">API</a>
        <a className="feedback-link mcp-docs-link" href="#mcp">MCP</a>
        <a className="feedback-link support-link" href="#support">Support</a>
      </div>
    </header>
    <h1 id="hero">The board for endpoint engineers.</h1>
  </div>
);
