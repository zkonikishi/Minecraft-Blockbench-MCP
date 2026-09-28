import { requireCube, requireProject, refreshView } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { CommandError } from "../errors.js";
import { resolveUvMode, type UvMode } from "./uv-mode.js";

export { paintFaceFeature, paintFaceFeatures } from "./face-batch.js";
export { shadeModelBase } from "./shade-base.js";
export { packBoxUv } from "./pack-uv.js";
export { getUvLayout, getUvMap } from "./uv-layout.js";

export function autoUvCubes(opts: {
  cubes?: string[];
  mode?: UvMode | "auto";
}): { ok: true; undo_label: string; mode: UvMode; updated: string[] } {
  requireProject();
  const list =
    opts.cubes && opts.cubes.length > 0
      ? opts.cubes.map((n) => requireCube(n))
      : [...Cube.all];
  if (list.length === 0) {
    throw new CommandError("E_NOT_FOUND", "No cubes to UV.");
  }
  const mode = resolveUvMode({
    explicit: opts.mode ?? "auto",
    cubes: list,
  });
  const host = getHost();
  return host.undo.run(
    { elements: list, uv_only: true },
    "auto_uv_cubes",
    () => {
      const updated: string[] = [];
      for (const cube of list) {
        cube.box_uv = mode === "box";
        cube.autouv = 1;
        cube.mapAutoUV?.();
        updated.push(cube.uuid);
      }
      refreshView(list.map((c) => ({ uuid: c.uuid, name: c.name })));
      return { ok: true as const, undo_label: "auto_uv_cubes", mode, updated };
    },
  );
}
