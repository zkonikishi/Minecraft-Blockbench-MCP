import type { Vec3 } from "@blockbench-mcp/shared";
import { findElement, refreshView, requireProject } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { CommandError } from "../errors.js";
import { resolveUvMode } from "../paint/uv-mode.js";

export function applyGeometryBatch(opts: {
  create_groups?: Array<{
    name: string;
    origin?: Vec3;
    rotation?: Vec3;
    parent?: string;
  }>;
  create_cubes?: Array<{
    name: string;
    from: Vec3;
    to: Vec3;
    origin?: Vec3;
    rotation?: Vec3;
    inflate?: number;
    parent?: string;
  }>;
  delete_uuids?: string[];
  undo_label?: string;
}): {
  ok: true;
  undo_label: string;
  created: { uuid: string; name: string; type: string }[];
  deleted: string[];
} {
  requireProject();
  const label = opts.undo_label ?? "apply_geometry_batch";
  const pendingGroups = new Set(
    (opts.create_groups ?? []).map((g) => g.name),
  );
  for (const g of opts.create_groups ?? []) {
    if (
      g.parent &&
      g.parent !== "root" &&
      !pendingGroups.has(g.parent) &&
      !findElement(g.parent)
    ) {
      throw new CommandError("E_PARTIAL_FORBIDDEN", `Missing parent group: ${g.parent}`);
    }
  }
  for (const c of opts.create_cubes ?? []) {
    if (
      c.parent &&
      c.parent !== "root" &&
      !pendingGroups.has(c.parent) &&
      !findElement(c.parent)
    ) {
      throw new CommandError("E_PARTIAL_FORBIDDEN", `Missing parent for cube: ${c.parent}`);
    }
  }
  for (const id of opts.delete_uuids ?? []) {
    if (!findElement(id)) {
      throw new CommandError("E_PARTIAL_FORBIDDEN", `Cannot delete missing element: ${id}`);
    }
  }

  const host = getHost();
  const boxUv = resolveUvMode() === "box";
  return host.undo.run({ outliner: true, elements: [] }, label, (track) => {
    const created: { uuid: string; name: string; type: string }[] = [];
    const deleted: string[] = [];
    const nameToGroup = new Map<string, Group>();

    for (const spec of opts.create_groups ?? []) {
      const parent =
        !spec.parent || spec.parent === "root"
          ? "root"
          : (nameToGroup.get(spec.parent) ??
            (findElement(spec.parent) as Group | undefined) ??
            "root");
      const group = new Group({
        name: spec.name,
        origin: spec.origin ? [...spec.origin] : [0, 0, 0],
        rotation: spec.rotation ? [...spec.rotation] : [0, 0, 0],
      })
        .init()
        .addTo(parent as Group | "root");
      group.createUniqueName?.();
      nameToGroup.set(group.name, group);
      const row = { uuid: group.uuid, name: group.name, type: "group" };
      created.push(row);
      track.addElements([group as unknown as { uuid: string; name: string }]);
    }

    const tex = host.textures.defaultOrFirst();
    for (const spec of opts.create_cubes ?? []) {
      const parent =
        !spec.parent || spec.parent === "root"
          ? "root"
          : (nameToGroup.get(spec.parent) ??
            (findElement(spec.parent) as Group | undefined) ??
            "root");
      const cube = new Cube({
        name: spec.name,
        from: [...spec.from],
        to: [...spec.to],
        origin: spec.origin ? [...spec.origin] : [...spec.from],
        rotation: spec.rotation ? [...spec.rotation] : [0, 0, 0],
        inflate: spec.inflate ?? 0,
        autouv: 1,
        box_uv: boxUv,
      })
        .init()
        .addTo(parent as Group | "root");
      cube.mapAutoUV?.();
      if (tex) tex.applyToCube(cube.uuid, true);
      const row = { uuid: cube.uuid, name: cube.name, type: "cube" };
      created.push(row);
      track.addElements([cube as unknown as { uuid: string; name: string }]);
    }

    for (const id of opts.delete_uuids ?? []) {
      const el = findElement(id);
      if (!el) continue;
      deleted.push(el.uuid);
      el.remove?.(false);
    }

    refreshView(created);
    return { ok: true as const, undo_label: label, created, deleted };
  });
}
