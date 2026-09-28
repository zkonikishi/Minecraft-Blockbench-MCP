import type { Vec3 } from "@blockbench-mcp/shared";
import {
  parentOf,
  refreshView,
  requireCube,
  requireGroup,
  requireProject,
} from "../bb/elements.js";
import { getHost } from "../host/live.js";

function copyFaces(source: Cube, target: Cube): void {
  for (const [name, face] of Object.entries(source.faces ?? {})) {
    const output = target.faces?.[name];
    if (!output || !face) continue;
    if (face.uv) output.uv = [...face.uv];
    output.rotation = face.rotation ?? 0;
    output.texture = face.texture;
  }
}

function rotated(
  point: number[],
  pivot: Vec3,
  axis: number,
  degrees: number,
): Vec3 {
  const out = point.map((value, i) => value - pivot[i]) as Vec3;
  const a = (axis + 1) % 3;
  const b = (axis + 2) % 3;
  const radians = (degrees * Math.PI) / 180;
  const av = out[a] * Math.cos(radians) - out[b] * Math.sin(radians);
  const bv = out[a] * Math.sin(radians) + out[b] * Math.cos(radians);
  out[a] = av;
  out[b] = bv;
  return out.map((value, i) => value + pivot[i]) as Vec3;
}

function cloneCube(
  source: Cube,
  parent: Group | "root",
  name: string,
  transform: (point: number[]) => Vec3,
  rotation: Vec3,
  uvPolicy: "share" | "auto",
): Cube {
  const center = source.from.map((value, i) => (value + source.to[i]) / 2);
  const nextCenter = transform(center);
  const half = source.from.map(
    (value, i) => Math.abs(source.to[i] - value) / 2,
  );
  const cube = new Cube({
    name,
    from: nextCenter.map((value, i) => value - half[i]),
    to: nextCenter.map((value, i) => value + half[i]),
    origin: transform(source.origin),
    rotation,
    inflate: source.inflate ?? 0,
    box_uv: source.box_uv,
    mirror_uv: source.mirror_uv,
    uv_offset: source.uv_offset ? [...source.uv_offset] : undefined,
    autouv: uvPolicy === "auto" ? 1 : 0,
  })
    .init()
    .addTo(parent);
  if (uvPolicy === "auto") cube.mapAutoUV?.();
  else copyFaces(source, cube);
  return cube;
}

export function radialArrayCubes(opts: {
  sources: string[];
  count: number;
  axis?: "x" | "y" | "z";
  pivot: Vec3;
  angle?: number;
  rotate_cubes?: boolean;
  name_pattern?: string;
  uv_policy?: "share" | "auto";
  parent?: string;
}) {
  requireProject();
  const sources = opts.sources.map(requireCube);
  const axis = opts.axis === "x" ? 0 : opts.axis === "z" ? 2 : 1;
  const total = opts.angle ?? 360;
  const targetParent = opts.parent ? parentOf(opts.parent) : undefined;
  const host = getHost();
  return host.undo.run({ outliner: true }, "radial_array_cubes", (track) => {
    const created: Array<{ uuid: string; name: string; type: string }> = [];
    for (let index = 1; index < opts.count; index += 1) {
      const degrees = (total * index) / opts.count;
      for (const source of sources) {
        const parent =
          targetParent ??
          (!source.parent ||
          source.parent === "root" ||
          typeof source.parent === "string"
            ? "root"
            : source.parent);
        const rotation = [...source.rotation] as Vec3;
        if (opts.rotate_cubes !== false) rotation[axis] += degrees;
        const name = (opts.name_pattern ?? "{name}_{index}")
          .replace(/\{name\}/g, source.name)
          .replace(/\{index\}/g, String(index));
        const cube = cloneCube(
          source,
          parent,
          name,
          (point) => rotated(point, opts.pivot, axis, degrees),
          rotation,
          opts.uv_policy ?? "share",
        );
        created.push({ uuid: cube.uuid, name: cube.name, type: "cube" });
        track.addElements([cube]);
      }
    }
    refreshView(created);
    return { ok: true as const, undo_label: "radial_array_cubes", created };
  });
}

export function duplicateHierarchy(opts: {
  root: string;
  name_suffix?: string;
  translate?: Vec3;
  parent?: string;
  uv_policy?: "share" | "auto";
}) {
  requireProject();
  const sourceRoot = requireGroup(opts.root);
  const suffix = opts.name_suffix ?? "_copy";
  const delta = opts.translate ?? [0, 0, 0];
  const targetParent = opts.parent ? parentOf(opts.parent) : "root";
  return getHost().undo.run(
    { outliner: true },
    "duplicate_hierarchy",
    (track) => {
      const created: Array<{ uuid: string; name: string; type: string }> = [];
      const copyGroup = (source: Group, parent: Group | "root"): Group => {
        const group = new Group({
          name: `${source.name}${suffix}`,
          origin: source.origin.map((value, i) => value + delta[i]),
          rotation: [...source.rotation],
        })
          .init()
          .addTo(parent);
        created.push({ uuid: group.uuid, name: group.name, type: "group" });
        track.addElements([group]);
        for (const child of source.children ?? []) {
          if (child instanceof Group) copyGroup(child, group);
          else {
            const cube = cloneCube(
              child,
              group,
              `${child.name}${suffix}`,
              (point) => point.map((value, i) => value + delta[i]) as Vec3,
              [...child.rotation] as Vec3,
              opts.uv_policy ?? "share",
            );
            created.push({ uuid: cube.uuid, name: cube.name, type: "cube" });
            track.addElements([cube]);
          }
        }
        return group;
      };
      copyGroup(sourceRoot, targetParent);
      refreshView(created);
      return { ok: true as const, undo_label: "duplicate_hierarchy", created };
    },
  );
}
