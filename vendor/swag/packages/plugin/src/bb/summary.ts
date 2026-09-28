import { requireProject, currentFormatId } from "./elements.js";
import { bbAnimation } from "./globals.js";
import type { ProjectSummary } from "@blockbench-mcp/shared";
import { resolveUvMode } from "../paint/uv-mode.js";

export function buildProjectSummary(): ProjectSummary {
  requireProject();
  const outliner: ProjectSummary["outliner"] = [];
  for (const g of Group.all) {
    const parent =
      !g.parent || g.parent === "root"
        ? null
        : typeof g.parent === "string"
          ? g.parent
          : g.parent.uuid;
    outliner.push({
      uuid: g.uuid,
      name: g.name,
      type: "group",
      parent,
    });
  }
  for (const c of Cube.all) {
    const parent =
      !c.parent || c.parent === "root"
        ? null
        : typeof c.parent === "string"
          ? c.parent
          : c.parent.uuid;
    outliner.push({
      uuid: c.uuid,
      name: c.name,
      type: "cube",
      parent,
    });
  }
  return {
    format: currentFormatId() ?? "unknown",
    name: Project?.name,
    geometry_name: (Project as typeof Project & { geometry_name?: string })
      ?.geometry_name,
    texture_width: Project?.texture_width,
    texture_height: Project?.texture_height,
    uv_mode: resolveUvMode({ cubes: [...Cube.all] }),
    cubes: Cube.all.length,
    groups: Group.all.length,
    textures: Texture.all.length,
    animations: bbAnimation()?.all?.length ?? 0,
    outliner,
  };
}
