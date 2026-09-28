import type { Vec3 } from "@blockbench-mcp/shared";
import {
  parentOf,
  refreshView,
  requireCube,
  requireProject,
} from "../bb/elements.js";
import { getHost } from "../host/live.js";

function copyFaces(source: Cube, target: Cube): void {
  for (const [name, face] of Object.entries(source.faces ?? {})) {
    const output = target.faces?.[name];
    if (!output || !face) continue;
    if (face.uv) output.uv = [...face.uv];
    (output as unknown as { rotation?: number }).rotation =
      (face as unknown as { rotation?: number }).rotation ?? 0;
    output.texture = face.texture;
  }
}

export function arrayCubes(opts: {
  sources: string[];
  count: number;
  offset: Vec3;
  name_pattern?: string;
  uv_policy?: "share" | "auto";
  parent?: string;
}): {
  ok: true;
  undo_label: string;
  created: Array<{ uuid: string; name: string; type: string }>;
} {
  requireProject();
  const sources = opts.sources.map(requireCube);
  const host = getHost();
  const parent = opts.parent ? parentOf(opts.parent) : undefined;
  return host.undo.run(
    { outliner: true, elements: [] },
    "array_cubes",
    (track) => {
      const created: Array<{ uuid: string; name: string; type: string }> = [];
      for (let index = 1; index <= opts.count; index += 1)
        for (const source of sources) {
          const delta = opts.offset.map((value) => value * index) as Vec3;
          const name = (opts.name_pattern ?? "{name}_{index}")
            .replace(/\{name\}/g, source.name)
            .replace(/\{index\}/g, String(index));
          const targetParent =
            parent ??
            (!source.parent ||
            source.parent === "root" ||
            typeof source.parent === "string"
              ? "root"
              : source.parent);
          const cube = new Cube({
            name,
            from: source.from.map((v, i) => v + delta[i]),
            to: source.to.map((v, i) => v + delta[i]),
            origin: source.origin.map((v, i) => v + delta[i]),
            rotation: [...source.rotation],
            inflate: source.inflate ?? 0,
            box_uv: source.box_uv,
            mirror_uv: source.mirror_uv,
            autouv: opts.uv_policy === "auto" ? 1 : 0,
            uv_offset: source.uv_offset ? [...source.uv_offset] : undefined,
          })
            .init()
            .addTo(targetParent);
          if (opts.uv_policy === "auto") cube.mapAutoUV?.();
          else copyFaces(source, cube);
          const row = { uuid: cube.uuid, name: cube.name, type: "cube" };
          created.push(row);
          track.addElements([
            cube as unknown as { uuid: string; name: string },
          ]);
        }
      refreshView(created);
      return { ok: true as const, undo_label: "array_cubes", created };
    },
  );
}
