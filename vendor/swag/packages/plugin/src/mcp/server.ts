import type { PluginRuntimeConfig } from "../config.js";
import type { SessionState } from "../session.js";
import { bbBlockbench } from "../bb/globals.js";
import { loadNet, type NetServer } from "./net.js";
import { attachHttpServer, writeHttp, type HttpRequest } from "./http-server.js";
import { handleMcpJsonRpc } from "./rpc.js";
import type { NetSocket } from "./net.js";

export interface McpHandle {
  stop: () => void;
  port: number;
  running: () => boolean;
}

function authorized(req: HttpRequest, secret: string): boolean {
  const auth = req.headers.authorization ?? "";
  if (auth.toLowerCase().startsWith("bearer ") && auth.slice(7).trim() === secret) {
    return true;
  }
  const alt = req.headers["x-mcp-secret"];
  return alt === secret;
}

function pathOnly(path: string): string {
  const q = path.indexOf("?");
  return q === -1 ? path : path.slice(0, q);
}

export function startMcpHttp(
  config: PluginRuntimeConfig,
  session: SessionState,
): McpHandle {
  const net = loadNet();
  let server: NetServer | null = null;
  let listening = false;

  const onRequest = async (req: HttpRequest, socket: NetSocket) => {
    const path = pathOnly(req.path);

    if (req.method === "OPTIONS") {
      writeHttp(socket, 204, undefined);
      return;
    }

    if (path === "/" || path === "/health") {
      writeHttp(
        socket,
        200,
        JSON.stringify({
          ok: true,
          service: "blockbench-mcp",
          mcp: `http://127.0.0.1:${config.port}/mcp`,
        }),
      );
      return;
    }

    if (path !== "/mcp") {
      writeHttp(socket, 404, JSON.stringify({ error: "not found" }));
      return;
    }

    if (req.method === "GET") {
      // Streamable HTTP clients may probe GET; we only support JSON POST replies.
      writeHttp(
        socket,
        405,
        JSON.stringify({
          error: "Use POST /mcp (Streamable HTTP JSON). SSE stream not required.",
        }),
      );
      return;
    }

    if (req.method === "DELETE") {
      writeHttp(socket, 200, JSON.stringify({ ok: true }));
      return;
    }

    if (req.method !== "POST") {
      writeHttp(socket, 405, JSON.stringify({ error: "POST only" }));
      return;
    }

    if (!authorized(req, config.secret)) {
      writeHttp(socket, 401, JSON.stringify({ error: "unauthorized" }));
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(req.body || "{}");
    } catch {
      writeHttp(
        socket,
        400,
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        }),
      );
      return;
    }

    const result = await handleMcpJsonRpc(session, parsed);
    const extra: Record<string, string> = {};
    if (result.sessionId) {
      extra["Mcp-Session-Id"] = result.sessionId;
    }
    writeHttp(socket, result.status, result.body, extra);
  };

  server = attachHttpServer(net, onRequest);
  server.on("error", ((err: { message?: string }) => {
    listening = false;
    bbBlockbench().showQuickMessage?.(
      `MCP server error: ${err?.message ?? "unknown"}`,
      4000,
    );
  }) as (...args: never[]) => void);

  server.listen(config.port, "127.0.0.1", () => {
    listening = true;
    bbBlockbench().showQuickMessage?.(
      `MCP ready → http://127.0.0.1:${config.port}/mcp`,
      3500,
    );
  });

  return {
    port: config.port,
    running: () => listening && !!server,
    stop: () => {
      listening = false;
      server?.close();
      server = null;
    },
  };
}
