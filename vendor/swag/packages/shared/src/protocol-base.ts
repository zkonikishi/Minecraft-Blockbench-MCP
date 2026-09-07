import { z } from "zod";

/** Protocol version for in-plugin HTTP MCP. */
export const PROTOCOL_VERSION = 1;

export const DEFAULTS = {
  /** Loopback HTTP MCP port (plugin hosts `/mcp`). */
  mcpPort: 39741,
  /** Default longest screenshot edge — keep context cheap. */
  screenshotMaxEdge: 256,
  screenshotMaxEdgeCap: 1024,
  screenshotQuality: 70,
  screenshotFormat: "jpeg" as const,
} as const;

export const ERROR_CODES = [
  "E_PLUGIN_DISCONNECTED",
  "E_SECRET_MISSING",
  "E_AUTH_FAILED",
  "E_PROTOCOL_MISMATCH",
  "E_TIMEOUT",
  "E_INVALID_PARAM",
  "E_UNKNOWN_PARAM",
  "E_UNSUPPORTED_FORMAT",
  "E_UNSUPPORTED_COMMAND",
  "E_SCOPE_DENIED",
  "E_PARTIAL_FORBIDDEN",
  "E_NOT_FOUND",
  "E_BLOCKBENCH_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorPayloadSchema = z
  .object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  })
  .strict();

export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

export function makeError(
  code: ErrorCode,
  message: string,
  details?: unknown,
): ErrorPayload {
  return details === undefined ? { code, message } : { code, message, details };
}

export const PROJECT_FORMATS = ["java_block", "bedrock", "bedrock_old", "geckolib_model"] as const;
export type ProjectFormat = (typeof PROJECT_FORMATS)[number];

export const VIEW_PRESETS = [
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
  "iso",
] as const;
export type ViewPreset = (typeof VIEW_PRESETS)[number];

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof vec3Schema>;
