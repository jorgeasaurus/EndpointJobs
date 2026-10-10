"use client";

import { useState } from "react";
import { ApiCodeBlock } from "@/components/api-code-block";
import { siteUrl } from "@/app/site-metadata";

const endpoint = `${siteUrl}/api/mcp`;
const json = (value: unknown) => JSON.stringify(value, null, 2);
type ClientSetup = { id: string; name: string; steps: string[]; note?: string; code?: string; language?: string; source?: string };
const clients: ClientSetup[] = [
  {
    id: "chatgpt", name: "ChatGPT",
    steps: ["Open ChatGPT’s Plugins page. Select the plus button, then Add custom MCP server.", `Name it Endpoint Jobs and enter ${endpoint} as the Server URL. Choose No authentication.`, "Review the connection notice, select Create as a plugin, and install it. Select or mention the plugin in your conversation."],
    note: "Custom MCP access depends on your plan and workspace permissions.",
    source: "https://developers.openai.com/api/docs/guides/custom-mcp-server"
  },
  {
    id: "codex", name: "Codex",
    steps: ["Run the command below in a terminal with the Codex CLI installed.", "Start a new Codex session and ask it to use Endpoint Jobs. Use codex mcp list to check the saved configuration."],
    code: `codex mcp add endpointjobs --url ${endpoint}\ncodex mcp list`, language: "shell",
    note: "Alternatively, add [mcp_servers.endpointjobs] with this URL in ~/.codex/config.toml. No bearer token is needed.",
    source: "https://developers.openai.com/codex/mcp"
  },
  {
    id: "claude", name: "Claude",
    steps: ["Open Customize → Connectors. Select Add, then Add custom connector.", `Name it Endpoint Jobs, enter ${endpoint}, and continue. Select No sign in and finish adding the connector.`, "In a conversation, open + → Connectors and enable Endpoint Jobs."],
    note: "For a managed workspace, an owner may need to add it under Organization settings → Connectors first. This remote connector is configured through your Claude account.",
    source: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"
  },
  {
    id: "claude-code", name: "Claude Code",
    steps: ["Run the command below to add the server for your user account.", "Open Claude Code and run /mcp to check the connection, then ask it to search Endpoint Jobs."],
    code: `claude mcp add --transport http --scope user endpointjobs ${endpoint}`, language: "shell",
    source: "https://code.claude.com/docs/en/mcp"
  },
  {
    id: "grok", name: "Grok / xAI API",
    steps: ["Use the xAI Responses API with an xAI API key in the XAI_API_KEY environment variable.", "Send this request to let Grok discover and call the Endpoint Jobs tools."],
    note: "This is the documented API integration, not a setup flow for the Grok consumer app. xAI API access and usage charges are separate from the free Endpoint Jobs server.",
    code: `curl https://api.x.ai/v1/responses \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $XAI_API_KEY" \\\n  -d '${json({ model: "grok-4.7", input: "Use Endpoint Jobs to find remote Intune roles. Include application links.", tools: [{ type: "mcp", server_url: endpoint, server_label: "endpointjobs" }] })}'`, language: "shell",
    source: "https://docs.x.ai/developers/tools/remote-mcp"
  },
  {
    id: "openclaw", name: "OpenClaw",
    steps: ["Run the commands below to register the remote server and probe its connection.", "Start a new agent turn and ask OpenClaw to search Endpoint Jobs. If the tools do not appear, reload or restart the Gateway running your agent."],
    code: `openclaw mcp add endpointjobs --url ${endpoint} --transport streamable-http\nopenclaw mcp doctor endpointjobs --probe`, language: "shell",
    source: "https://docs.openclaw.ai/tools/mcp"
  },
  {
    id: "hermes", name: "Hermes Agent",
    steps: ["Merge the entry below into ~/.hermes/config.yaml. Keep any existing mcp_servers entries.", "Restart Hermes and ask it to discover the Endpoint Jobs tools."],
    code: `mcp_servers:\n  endpointjobs:\n    url: ${endpoint}`, language: "yaml",
    note: "Hermes uses Streamable HTTP by default. Current releases accept this endpoint’s GET/HEAD 405 responses during preflight; no skip_preflight override is needed.",
    source: "https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference"
  },
  {
    id: "cursor", name: "Cursor",
    steps: ["Merge this configuration into .cursor/mcp.json in your project, or ~/.cursor/mcp.json for all projects.", "Enable the server in Cursor’s MCP settings and use it in Agent chat."],
    code: json({ mcpServers: { endpointjobs: { url: endpoint } } }), language: "json",
    source: "https://cursor.com/docs/mcp"
  },
  {
    id: "vscode", name: "VS Code / Copilot",
    steps: ["Merge this configuration into .vscode/mcp.json in your workspace.", "Run MCP: List Servers from the Command Palette and start Endpoint Jobs. Enable its tools in agent chat; review any trust prompt."],
    code: json({ servers: { endpointjobs: { type: "http", url: endpoint } } }), language: "json",
    source: "https://code.visualstudio.com/docs/agent-customization/mcp-servers"
  },
  {
    id: "other", name: "Other MCP clients",
    steps: ["Find your client’s MCP, connectors, integrations, or external tools settings. Add a remote server named Endpoint Jobs.", `Set the server URL to ${endpoint}. Choose Streamable HTTP (sometimes called HTTP) and no authentication.`, "Connect and discover tools. Confirm search_jobs, get_job, and get_filter_options are available, then try the example request below."],
    note: "Configuration keys vary by client. A client that supports only local stdio servers needs a compatible HTTP bridge; pasting a URL into a launch-command field will not work. A browser GET to this endpoint returns 405 by design—test it with an MCP client. Browser-direct clients also need their Origin allowed by the server operator.",
    code: `Name: Endpoint Jobs\nURL: ${endpoint}\nTransport: Streamable HTTP\nAuthentication: None`, language: "text"
  }
];

export function McpClientSetup() {
  const [selected, setSelected] = useState("chatgpt");
  const client = clients.find((entry) => entry.id === selected) ?? clients[0];
  return (
    <section className="mcp-client-setup" aria-labelledby="mcp-client-heading">
      <div><span className="section-kicker">Choose your client</span><h2 id="mcp-client-heading">Connect your assistant.</h2></div>
      <label htmlFor="mcp-client">Assistant or app</label>
      <select id="mcp-client" value={selected} onChange={(event) => setSelected(event.target.value)} aria-controls="mcp-client-details">
        {clients.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
      <div id="mcp-client-details" key={client.id}>
        <h3>{client.name}</h3>
        <ol>{client.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        {client.note && <p>{client.note}</p>}
        {client.code && <ApiCodeBlock code={client.code} language={client.language ?? "text"} title={`${client.name} setup`} />}
        {client.source && <a href={client.source} target="_blank" rel="noopener noreferrer">Official {client.name} documentation ↗</a>}
      </div>
      <p className="mcp-client-footnote">Setup guidance follows each client’s documentation. Menus and access can vary by version or plan; individual client connections have not all been tested.</p>
    </section>
  );
}
