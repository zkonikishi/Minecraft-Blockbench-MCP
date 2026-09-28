import type { Vec3 } from "@blockbench-mcp/shared";
import { parentOf, refreshView, requireProject } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { resolveUvMode } from "../paint/uv-mode.js";

export interface LimbResult {
  created: { uuid: string; name: string; type: string }[];
}

function hangFromPivot(pivot: Vec3, size: Vec3, from?: Vec3): { from: Vec3; to: Vec3 } {
  if (from) {
    return {
      from,
      to: [from[0] + size[0], from[1] + size[1], from[2] + size[2]],
    };
  }
  const fromAuto: Vec3 = [
    pivot[0] - size[0] / 2,
    pivot[1] - size[1],
    pivot[2] - size[2] / 2,
  ];
  return {
    from: fromAuto,
    to: [fromAuto[0] + size[0], fromAuto[1] + size[1], fromAuto[2] + size[2]],
  };
}

function addLimbSide(
  name: string,
  pivot: Vec3,
  size: Vec3,
  parent: Group | "root",
  from?: Vec3,
): { group: Group; cube: Cube } {
  const box = hangFromPivot(pivot, size, from);
  const group = new Group({
    name,
    origin: [...pivot],
    rotation: [0, 0, 0],
  })
    .init()
    .addTo(parent);
  group.createUniqueName?.();
  const cube = new Cube({
    name: `${name}_cube`,
    from: box.from,
    to: box.to,
    origin: [...pivot],
    autouv: 1,
    box_uv: resolveUvMode() === "box",
  })
    .init()
    .addTo(group);
  cube.mapAutoUV?.();
  const tex = getHost().textures.defaultOrFirst();
  if (tex) tex.applyToCube(cube.uuid, true);
  return { group, cube };
}

export function createLimb(opts: {
  name: string;
  parent?: string;
  pivot: Vec3;
  size: Vec3;
  from?: Vec3;
  mirror?: "none" | "x";
  undo_label?: string;
}): LimbResult {
  requireProject();
  const parent = parentOf(opts.parent);
  const label = opts.undo_label ?? `create_limb ${opts.name}`;
  const host = getHost();
  return host.undo.run({ outliner: true, elements: [] }, label, (track) => {
    const created: LimbResult["created"] = [];
    const primary = addLimbSide(opts.name, opts.pivot, opts.size, parent, opts.from);
    created.push(
      { uuid: primary.group.uuid, name: primary.group.name, type: "group" },
      { uuid: primary.cube.uuid, name: primary.cube.name, type: "cube" },
    );
    track.addElements(created);
    if (opts.mirror === "x") {
      const mirrorName = mirrorNameX(opts.name);
      const mp: Vec3 = [-opts.pivot[0], opts.pivot[1], opts.pivot[2]];
      const mf = opts.from
        ? ([-opts.from[0] - opts.size[0], opts.from[1], opts.from[2]] as Vec3)
        : undefined;
      const secondary = addLimbSide(mirrorName, mp, opts.size, parent, mf);
      const more = [
        { uuid: secondary.group.uuid, name: secondary.group.name, type: "group" },
        { uuid: secondary.cube.uuid, name: secondary.cube.name, type: "cube" },
      ];
      created.push(...more);
      track.addElements(more);
    }
    refreshView(created);
    return { created };
  });
}

function mirrorNameX(name: string): string {
  if (/right/i.test(name)) return name.replace(/right/gi, "left");
  if (/left/i.test(name)) return name.replace(/left/gi, "right");
  if (/_r\b/i.test(name)) return name.replace(/_r\b/i, "_l");
  if (/_l\b/i.test(name)) return name.replace(/_l\b/i, "_r");
  return `${name}_mirrored`;
}
