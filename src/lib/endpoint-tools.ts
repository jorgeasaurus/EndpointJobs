export const endpointToolDefinitions = [
  { tool: "Jamf", aliases: ["jamf", "jamf pro", "jamf school"], strong: true },
  {
    tool: "Intune",
    aliases: ["intune", "endpoint manager", "microsoft endpoint manager"],
    strong: true
  },
  {
    tool: "SCCM",
    aliases: ["sccm", "mecm", "configuration manager", "configmgr"],
    strong: true
  },
  {
    tool: "Fleet MDM",
    aliases: ["fleet mdm", "fleetdm", "fleet device management"],
    strong: true
  },
  { tool: "Kandji", aliases: ["kandji", "kanji"], strong: true },
  { tool: "NinjaOne", aliases: ["ninjaone", "ninja one"], strong: true },
  {
    tool: "Workspace ONE",
    aliases: ["workspace one", "workspaceone", "airwatch"],
    strong: true
  },
  { tool: "Tanium", aliases: ["tanium"], strong: true },
  { tool: "Okta", aliases: ["okta"], strong: false },
  { tool: "Entra ID", aliases: ["entra id", "entra", "azure ad"], strong: false },
  { tool: "Autopilot", aliases: ["autopilot", "windows autopilot"], strong: true },
  { tool: "PowerShell", aliases: ["powershell", "power shell", "pwsh"], strong: true },
  { tool: "Defender", aliases: ["defender", "microsoft defender", "mde"], strong: false }
] as const;

export type EndpointTool = (typeof endpointToolDefinitions)[number]["tool"];

export const endpointToolOptions: EndpointTool[] = endpointToolDefinitions.map(
  ({ tool }) => tool
);
