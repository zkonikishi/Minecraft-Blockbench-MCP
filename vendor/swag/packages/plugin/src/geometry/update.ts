import type { Vec3 } from "@blockbench-mcp/shared";
import {
  findElement,
  parentOf,
  refreshView,
  requireCube,
  requireProject,
} from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";

type Update = {
  ref: string;
  name?: string;
  parent?: string;
  from?: Vec3;
  to?: Vec3;
  origin?: Vec3;
  rotation?: Vec3;
  inflate?: number;
  visibility?: boolean;
};

function isDescendant(candidate: Group, ancestor: Group): boolean {
  let current: Group | "root" | string | undefined = candidate.parent;
  while (current && current !== "root") {
    if (typeof current === "string") return current === ancestor.uuid;
    if (current.uuid === ancestor.uuid) return true;
    current = current.parent;
  }
  return false;
}

export function updateElements(opts: {
  updates: Update[];
  undo_label?: string;
  uv_policy?: "preserve" | "auto";
}): { ok: true; undo_label: string; updated: string[] } {
  requireProject();
  const resolved = opts.updates.map((update) => {
    const element = findElement(update.ref);
    if (!element)
      throw new CommandError("E_NOT_FOUND", `Element not found: ${update.ref}`);
    const parent =
      update.parent === undefined ? undefined : parentOf(update.parent);
    if (parent !== undefined && parent !== "root" && element instanceof Group) {
      if (parent.uuid === element.uuid || isDescendant(parent, element)) {
        throw new CommandError(
          "E_INVALID_PARAM",
          `Reparenting ${element.name} would create a cycle`,
        );
      }
    }
    if (
      element instanceof Group &&
      (update.from || update.to || update.inflate !== undefined)
    ) {
      throw new CommandError(
        "E_INVALID_PARAM",
        `Group ${element.name} does not support from, to, or inflate`,
      );
    }
    return { update, element, parent };
  });
  const elements = [...new Set(resolved.map((item) => item.element))];
  const label = opts.undo_label ?? "update_elements";
  return getHost().undo.run({ outliner: true, elements }, label, () => {
    for (const { update, element, parent } of resolved) {
      if (update.name !== undefined) element.name = update.name;
      if (update.origin !== undefined) element.origin = [...update.origin];
      if (update.rotation !== undefined)
        element.rotation = [...update.rotation];
      if (update.visibility !== undefined) {
        (element as unknown as { visibility: boolean }).visibility =
          update.visibility;
      }
      if (element instanceof Cube) {
        const dimensionsChanged =
          update.from !== undefined || update.to !== undefined;
        if (update.from !== undefined) element.from = [...update.from];
        if (update.to !== undefined) element.to = [...update.to];
        if (update.inflate !== undefined) element.inflate = update.inflate;
        if (dimensionsChanged && opts.uv_policy === "auto") {
          element.autouv = 1;
          element.mapAutoUV?.();
        }
      }
      if (parent !== undefined) element.addTo(parent);
    }
    refreshView(elements);
    return {
      ok: true as const,
      undo_label: label,
      updated: elements.map((e) => e.uuid),
    };
  });
}

export function setFaceUv(opts: {
  entries: Array<{
    cube: string;
    face: string;
    uv: [number, number, number, number];
    rotation?: 0 | 90 | 180 | 270;
  }>;
}): { ok: true; undo_label: string; updated: string[] } {
  requireProject();
  const entries = opts.entries.map((entry) => {
    const cube = requireCube(entry.cube);
    const face = cube.faces?.[entry.face];
    if (!face)
      throw new CommandError(
        "E_INVALID_PARAM",
        `Face not found: ${entry.cube}.${entry.face}`,
      );
    return { entry, cube, face };
  });
  const cubes = [...new Set(entries.map((item) => item.cube))];
  return getHost().undo.run(
    { elements: cubes, uv_only: true },
    "set_face_uv",
    () => {
      for (const { entry, cube, face } of entries) {
        cube.box_uv = false;
        face.uv = [...entry.uv];
        if (entry.rotation !== undefined) {
          (face as unknown as { rotation: number }).rotation = entry.rotation;
        }
      }
      refreshView(cubes);
      return {
        ok: true as const,
        undo_label: "set_face_uv",
        updated: cubes.map((cube) => cube.uuid),
      };
    },
  );
}
