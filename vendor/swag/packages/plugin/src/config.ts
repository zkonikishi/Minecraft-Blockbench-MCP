import { DEFAULTS } from "@blockbench-mcp/shared";

export interface PluginRuntimeConfig {
  port: number;
  secret: string;
  autostart: boolean;
}

export function readPluginConfig(): PluginRuntimeConfig {
  const portRaw = settings?.mcp_port?.value;
  const secretRaw = settings?.mcp_secret?.value;
  const autoRaw = settings?.mcp_autostart?.value;
  const port =
    typeof portRaw === "number"
      ? portRaw
      : typeof portRaw === "string"
        ? Number(portRaw)
        : DEFAULTS.mcpPort;
  return {
    port: Number.isFinite(port) ? port : DEFAULTS.mcpPort,
    secret:
      typeof secretRaw === "string" && secretRaw.length > 0
        ? secretRaw
        : "dev-local-secret",
    autostart: autoRaw !== false,
  };
}

export function registerPluginSettings(): void {
  Settings.add?.("mcp_port", {
    value: DEFAULTS.mcpPort,
    category: "general",
    name: "MCP Server Port",
    description: "Loopback HTTP port for in-plugin MCP (127.0.0.1).",
    type: "number",
  });
  Settings.add?.("mcp_secret", {
    value: "dev-local-secret",
    category: "general",
    name: "MCP Shared Secret",
    description: "Bearer token Cursor must send as Authorization: Bearer …",
    type: "text",
  });
  Settings.add?.("mcp_autostart", {
    value: true,
    category: "general",
    name: "Start MCP Server automatically",
    description: "Listen for Cursor/AI as soon as the plugin loads.",
    type: "toggle",
  });
}
