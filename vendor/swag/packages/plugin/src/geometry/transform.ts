import type { Vec3 } from "@blockbench-mcp/shared";
import { findElement, refreshView, requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";

function rotatePoint(point: Vec3, pivot: Vec3, rotation: Vec3): Vec3 {
  let [x, y, z] = [
    point[0] - pivot[0],
    point[1] - pivot[1],
    point[2] - pivot[2],
  ];
  for (const [axis, degrees] of rotation.entries()) {
    if (degrees === 0) continue;
    const r = (degrees * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    if (axis === 0) [y, z] = [y * c - z * s, y * s + z * c];
    else if (axis === 1) [x, z] = [x * c + z * s, -x * s + z * c];
    else [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x + pivot[0], y + pivot[1], z + pivot[2]];
}


function composeRotation(current: Vec3, delta: Vec3): Vec3 {
  const columns = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]).map(
    (axis) => rotatePoint(rotatePoint(axis, [0, 0, 0], current), [0, 0, 0], delta),
  );
  const pitch = Math.asin(Math.max(-1, Math.min(1, -columns[0][2])));
  const regular = Math.abs(Math.cos(pitch)) > 1e-8;
  return [
    regular ? Math.atan2(columns[1][2], columns[2][2]) * 180 / Math.PI : 0,
    pitch * 180 / Math.PI,
    (regular ? Math.atan2(columns[0][1], columns[0][0]) : Math.atan2(-columns[1][0], columns[1][1])) * 180 / Math.PI,
  ];
}

export function transformElements(opts: {
  refs: string[];
  translate?: Vec3;
  scale?: Vec3;
  pivot?: Vec3;
  rotate?: Vec3;
  uv_policy?: "preserve" | "auto";
  undo_label?: string;
}): { ok: true; undo_label: string; updated: string[] } {
  requireProject();
  const selected = [...new Set(opts.refs.map((ref) => {
    const element = findElement(ref);
    if (!element) throw new CommandError("E_NOT_FOUND", "Element not found: " + ref);
    return element;
  }))];
  const roots = selected.filter((element) => {
    let parent = element.parent;
    while (parent && parent !== "root") {
      const group = typeof parent === "string" ? findElement(parent) : parent;
      if (!group) break;
      if (selected.includes(group)) return false;
      parent = group.parent;
    }
    return true;
  });
  const trees = roots.map((root) => {
    const nodes: Array<Group | Cube> = [];
    const visit = (element: Group | Cube) => {
      nodes.push(element);
      if (element instanceof Group) element.children.forEach(visit);
    };
    visit(root);
    return { root, nodes };
  });
  const elements = trees.flatMap((tree) => tree.nodes);
  const translate = opts.translate ?? [0, 0, 0];
  const scale = opts.scale ?? [1, 1, 1];
  const rotate = opts.rotate ?? [0, 0, 0];
  const pivot = opts.pivot ?? [0, 0, 0];
  if (scale.some((value) => value <= 0)) {
    throw new CommandError("E_INVALID_PARAM", "Scale components must be positive; use mirror_elements for reflection");
  }
  const uniform = scale.every((value) => Math.abs(value - scale[0]) < 1e-8);
  if (!uniform && elements.some((element) => element.rotation.some((value) => Math.abs(value) > 1e-8) || (element instanceof Cube && element.inflate !== 0))) {
    throw new CommandError("E_INVALID_PARAM", "Non-uniform scaling of rotated or inflated geometry would introduce shear; use uniform scale");
  }
  const label = opts.undo_label ?? "transform_elements";
  return getHost().undo.run({ outliner: true, elements }, label, () => {
    for (const { root, nodes } of trees) {
      const originalOrigin = [...root.origin] as Vec3;
      const scaledOrigin = originalOrigin.map((value, axis) => pivot[axis] + (value - pivot[axis]) * scale[axis]) as Vec3;
      const nextOrigin = rotatePoint(scaledOrigin, pivot, rotate).map((value, axis) => value + translate[axis]) as Vec3;
      const reposition = (point: number[]) => point.map((value, axis) => nextOrigin[axis] + (value - originalOrigin[axis]) * scale[axis]) as Vec3;
      for (const element of nodes) {
        element.origin = reposition(element.origin);
        if (element instanceof Cube) {
          element.from = reposition(element.from);
          element.to = reposition(element.to);
          if (uniform) element.inflate *= scale[0];
          if (opts.uv_policy === "auto") {
            element.autouv = 1;
            element.mapAutoUV?.();
          }
        }
      }
      root.rotation = composeRotation(root.rotation as Vec3, rotate);
    }
    refreshView(elements);
    return { ok: true as const, undo_label: label, updated: elements.map((element) => element.uuid) };
  });
}
