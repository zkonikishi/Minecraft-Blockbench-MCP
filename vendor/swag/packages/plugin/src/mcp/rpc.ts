import {
  COMMAND_SPECS,
  PLUGIN_VERSION,
  PROTOCOL_VERSION,
  resolveGuide,
  type CommandName,
  type CommandSpec,
  type ErrorPayload,
  type GuideTopic,
} from "@blockbench-mcp/shared";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { SessionState } from "../session.js";
import { dispatchCommand } from "../dispatch.js";
import { toErrorPayload } from "../errors.js";
import { bbBlockbench } from "../bb/globals.js";
import { currentFormatId } from "../bb/elements.js";
import { resolveUvMode } from "../paint/uv-mode.js";
import { getHost } from "../host/live.js";

type Content = Array<
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
>;

type JsonRpcId = string | number | null;

function envelope(
  ok: boolean,
  summary: string,
  result?: unknown,
  error?: ErrorPayload,
): { content: Content; isError?: boolean } {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ summary, ok, result, error }, null, 2),
      },
    ],
    ...(ok ? {} : { isError: true }),
  };
}

function withoutImageData(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  if (Array.isArray(result)) return result.map(withoutImageData);
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    if (key !== "data_url") clean[key] = withoutImageData(value);
  }
  return clean;
}

function attachImages(
  base: { content: Content; isError?: boolean },
  result: unknown,
): { content: Content; isError?: boolean } {
  if (!result || typeof result !== "object") return base;
  const images: Content = [];
  const views = (result as { views?: unknown }).views;
  if (Array.isArray(views)) {
    for (const v of views) {
      if (!v || typeof v !== "object") continue;
      const dataUrl = (v as { data_url?: string }).data_url;
      if (!dataUrl?.startsWith("data:")) continue;
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!m) continue;
      images.push({ type: "image", data: m[2], mimeType: m[1] });
    }
  }
  const sheet = (result as { data_url?: string }).data_url;
  if (typeof sheet === "string" && sheet.startsWith("data:")) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(sheet);
    if (m) images.push({ type: "image", data: m[2], mimeType: m[1] });
  }
  if (!images.length) return base;
  return { ...base, content: [...base.content, ...images] };
}

function toolInputSchema(spec: CommandSpec): Record<string, unknown> {
  try {
    return zodToJsonSchema(spec.params as z.ZodTypeAny, {
      $refStrategy: "none",
      target: "jsonSchema7",
    }) as Record<string, unknown>;
  } catch {
    return { type: "object", properties: {} };
  }
}

function listTools() {
  const tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> = [
    {
      name: "health",
      description:
        "Plugin MCP status: listening, Blockbench version, current format.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];
  for (const [name, spec] of Object.entries(COMMAND_SPECS) as Array<
    [CommandName, CommandSpec]
  >) {
    tools.push({
      name,
      description: spec.description,
      inputSchema: toolInputSchema(spec),
    });
  }
  return { tools };
}

async function callTool(
  session: SessionState,
  name: string,
  args: unknown,
): Promise<{ content: Content; isError?: boolean }> {
  if (name === "health") {
    return envelope(true, "Plugin MCP running", {
      protocol_version: PROTOCOL_VERSION,
      plugin_version: PLUGIN_VERSION,
      blockbench_version: bbBlockbench().version ?? "unknown",
      format: currentFormatId() ?? null,
      uv_mode: resolveUvMode({ cubes: [...Cube.all] }),
      capabilities: getHost().probeCapabilities(),
      mode: "in-process",
    });
  }

  const spec = (COMMAND_SPECS as Record<string, CommandSpec | undefined>)[name];
  if (!spec) {
    return envelope(false, `Unknown tool: ${name}`, undefined, {
      code: "E_UNSUPPORTED_COMMAND",
      message: `Unknown tool: ${name}`,
    });
  }

  const parsed = (spec.params as z.ZodTypeAny).safeParse(args ?? {});
  if (!parsed.success) {
    return envelope(false, "Invalid parameters", undefined, {
      code: "E_INVALID_PARAM",
      message: parsed.error.message,
      details: parsed.error.flatten(),
    });
  }

  if (name === "get_guide") {
    const topic = (parsed.data as { topic?: GuideTopic }).topic;
    const guide = resolveGuide(topic);
    return envelope(true, `Guide: ${guide.topic}`, guide);
  }

  try {
    const result = await dispatchCommand(session, name, parsed.data);
    const hasImages =
      name === "capture_views" ||
      name === "get_texture" ||
      name === "get_uv_map" ||
      name === "get_texture_region";
    const base = envelope(
      true,
      `OK: ${name}`,
      hasImages ? withoutImageData(result) : result,
    );
    return hasImages ? attachImages(base, result) : base;
  } catch (err) {
    const error =
      err && typeof err === "object" && "payload" in err
        ? (err as { payload: ErrorPayload }).payload
        : toErrorPayload(err);
    return envelope(false, error.message, undefined, error);
  }
}

export async function handleMcpJsonRpc(
  session: SessionState,
  message: unknown,
): Promise<{ status: number; body?: string; sessionId?: string }> {
  if (Array.isArray(message)) {
    const parts = [];
    for (const m of message) {
      const r = await handleOne(session, m);
      if (r.body) parts.push(JSON.parse(r.body));
    }
    return { status: 200, body: JSON.stringify(parts) };
  }
  return handleOne(session, message);
}

async function handleOne(
  session: SessionState,
  message: unknown,
): Promise<{ status: number; body?: string; sessionId?: string }> {
  if (!message || typeof message !== "object") {
    return {
      status: 400,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      }),
    };
  }

  const msg = message as {
    jsonrpc?: string;
    id?: JsonRpcId;
    method?: string;
    params?: unknown;
  };
  const hasId = Object.prototype.hasOwnProperty.call(msg, "id");
  const id = hasId ? (msg.id as JsonRpcId) : null;
  const method = msg.method;

  if (!method) {
    return {
      status: 400,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid Request" },
      }),
    };
  }

  // Notifications have no id
  if (!hasId && method.startsWith("notifications/")) {
    return { status: 202 };
  }

  if (method === "initialize") {
    return {
      status: 200,
      sessionId: `bbmcp-${Date.now()}`,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "blockbench-mcp",
            version: PLUGIN_VERSION,
          },
        },
      }),
    };
  }

  if (method === "ping") {
    return {
      status: 200,
      body: JSON.stringify({ jsonrpc: "2.0", id, result: {} }),
    };
  }

  if (method === "tools/list") {
    return {
      status: 200,
      body: JSON.stringify({ jsonrpc: "2.0", id, result: listTools() }),
    };
  }

  if (method === "tools/call") {
    const params = (msg.params ?? {}) as { name?: string; arguments?: unknown };
    const name = params.name ?? "";
    const result = await callTool(session, name, params.arguments);
    return {
      status: 200,
      body: JSON.stringify({ jsonrpc: "2.0", id, result }),
    };
  }

  return {
    status: 200,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    }),
  };
}
