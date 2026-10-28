import { createRoot } from "react-dom/client";

import { TopbarOverflow } from "../../../src/components/job-board/topbar-overflow";

const root = document.getElementById("root");
if (!root) throw new Error("missing root");

createRoot(root).render(
  <div>
    <button type="button">Outside</button>
    <TopbarOverflow>
      <a href="https://example.com/api-docs">API docs</a>
      <a href="https://example.com/mcp">MCP guide</a>
      <a href="https://github.com/jorgeasaurus/EndpointJobs/issues/new">Feedback</a>
      <a href="https://buymeacoffee.com/jorgeasaurus">Support the board</a>
    </TopbarOverflow>
  </div>
);
