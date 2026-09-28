import type { McpHandle } from "./server.js";

let toggle: Action | null = null;

export function registerMcpActions(options: {
  getHandle: () => McpHandle | null;
  start: () => void;
  stop: () => void;
}): () => void {
  const refresh = () => {
    const h = options.getHandle();
    const running = !!h?.running();
    toggle?.setName?.(
      running ? `Stop MCP Server (:${h?.port})` : "Start MCP Server",
    );
  };

  toggle = new Action("blockbench_mcp_toggle", {
    name: "Start MCP Server",
    icon: "smart_toy",
    category: "tools",
    click: () => {
      const h = options.getHandle();
      if (h?.running()) options.stop();
      else options.start();
      refresh();
    },
  });

  refresh();
  return () => {
    toggle?.delete();
    toggle = null;
  };
}
