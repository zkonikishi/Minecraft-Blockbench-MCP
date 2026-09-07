import { MIN_BLOCKBENCH_VERSION, PLUGIN_VERSION } from "@blockbench-mcp/shared";
import { readPluginConfig, registerPluginSettings } from "./config.js";
import { createSession, revokeScope } from "./session.js";
import { bbBlockbench, bbPlugin } from "./bb/globals.js";
import { startMcpHttp, type McpHandle } from "./mcp/server.js";
import { registerMcpActions } from "./mcp/actions.js";

const PROMPT_FLAG = "blockbench_mcp_prompt_start";

let mcp: McpHandle | null = null;
let disposeActions: (() => void) | null = null;
const session = createSession();
let loaded = false;
let freshInstallPending = false;
let loadGeneration = 0;
let postLoadTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPostLoadStart(): void {
  if (postLoadTimer !== null) clearTimeout(postLoadTimer);
  postLoadTimer = null;
}

function startServer(): void {
  if (mcp?.running()) return;
  mcp?.stop();
  const config = readPluginConfig();
  try {
    mcp = startMcpHttp(config, session);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    bbBlockbench().showQuickMessage?.(`MCP start failed: ${message}`, 5000);
    mcp = null;
  }
}

function stopServer(): void {
  mcp?.stop();
  mcp = null;
  bbBlockbench().showQuickMessage?.("MCP server stopped", 1500);
}

/** Fresh install: ask before touching `net` (permission dialog often skips sync onload). */
function promptStartAfterInstall(generation: number): void {
  if (!loaded || generation !== loadGeneration) return;
  const bb = bbBlockbench();
  const message =
    "Start the local MCP server now?\n\n" +
    "Blockbench will ask for network permission — choose Always allow.\n" +
    "Default: http://127.0.0.1:39741/mcp";

  if (typeof bb.showMessageBox === "function") {
    bb.showMessageBox(
      {
        title: "Blockbench MCP",
        message,
        buttons: ["Start MCP", "Later"],
        confirm: 0,
        cancel: 1,
      },
      (button) => {
        if (!loaded || generation !== loadGeneration) return;
        if (button === 0) startServer();
        else {
          bb.showQuickMessage?.(
            "MCP not started. Use Tools → Start MCP Server when ready.",
            4000,
          );
        }
      },
    );
    return;
  }

  // Fallback if showMessageBox is missing
  const ok =
    typeof window !== "undefined" &&
    window.confirm("Start Blockbench MCP server now? (needs network permission)");
  if (ok && loaded && generation === loadGeneration) startServer();
}

function schedulePostLoadStart(freshInstall: boolean): void {
  cancelPostLoadStart();
  const generation = loadGeneration;
  postLoadTimer = setTimeout(() => {
    postLoadTimer = null;
    if (!loaded || generation !== loadGeneration) return;
    if (freshInstall || freshInstallPending) {
      freshInstallPending = false;
      try {
        localStorage.removeItem(PROMPT_FLAG);
      } catch {
      }
      promptStartAfterInstall(generation);
      return;
    }
    if (readPluginConfig().autostart) startServer();
  }, freshInstall ? 400 : 80);
}

bbPlugin().register("blockbench_mcp", {
  title: "Blockbench MCP",
  author: "SwagRee",
  description:
    "In-process MCP for Minecraft modeling. Install the plugin, start the server, point Cursor at http://127.0.0.1:<port>/mcp.",
  icon: "smart_toy",
  version: PLUGIN_VERSION,
  variant: "desktop",
  min_version: MIN_BLOCKBENCH_VERSION,
  oninstall() {
    freshInstallPending = true;
    try {
      localStorage.setItem(PROMPT_FLAG, "1");
    } catch {
      /* ignore */
    }
    if (loaded) schedulePostLoadStart(true);
  },
  onload() {
    loaded = true;
    loadGeneration += 1;
    registerPluginSettings();
    disposeActions = registerMcpActions({
      getHandle: () => mcp,
      start: startServer,
      stop: stopServer,
    });

    let freshInstall = freshInstallPending;
    try {
      freshInstall = freshInstall || localStorage.getItem(PROMPT_FLAG) === "1";
    } catch {
    }

    schedulePostLoadStart(freshInstall);
    bbBlockbench().showQuickMessage?.(
      `Blockbench MCP ${PLUGIN_VERSION} (BB≥${MIN_BLOCKBENCH_VERSION})`,
      2500,
    );
  },
  onunload() {
    loaded = false;
    loadGeneration += 1;
    cancelPostLoadStart();
    disposeActions?.();
    disposeActions = null;
    stopServer();
    revokeScope(session);
  },
});
