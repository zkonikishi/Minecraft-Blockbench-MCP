import { getHost } from "../host/live.js";
import type { ProjectFormat } from "@blockbench-mcp/shared";

export function createProject(opts: {
  format: ProjectFormat;
  uv_mode?: "box" | "face";
  geometry_name?: string;
  name?: string;
  texture_width?: number;
  texture_height?: number;
}): { format: string; name?: string } {
  return getHost().formats.createProject(opts);
}
