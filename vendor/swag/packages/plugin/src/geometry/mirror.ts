import { findElement, refreshView, requireProject } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { CommandError } from "../errors.js";
import { resolveUvMode } from "../paint/uv-mode.js";

export function mirrorElements(opts: {
  names: string[];
  axis?: "x" | "y" | "z";
  pivot?: number;
  rename?: boolean;
}): { ok: true; undo_label: string; created: { uuid: string; name: string; type: string }[] } {
  requireProject();
  const axis = opts.axis ?? "x";
  const pivot = opts.pivot ?? 0;
  const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const label = `mirror_elements ${axis}`;
  const sources = opts.names.map((n) => {
    const el = findElement(n);
    if (!el) throw new CommandError("E_NOT_FOUND", `Element not found: ${n}`);
    return el;
  });
  const host = getHost();
  const boxUv = resolveUvMode() === "box";

  return host.undo.run({ outliner: true, elements: [] }, label, (track) => {
    const created: { uuid: string; name: string; type: string }[] = [];
    for (const el of sources) {
      if (isCube(el)) {
        const c = el as Cube;
        const from = [...c.from] as [number, number, number];
        const to = [...c.to] as [number, number, number];
        from[axisIndex] = pivot * 2 - from[axisIndex];
        to[axisIndex] = pivot * 2 - to[axisIndex];
        const lo = from.map((v, i) => Math.min(v, to[i])) as [number, number, number];
        const hi = from.map((v, i) => Math.max(v, to[i])) as [number, number, number];
        const name = opts.rename === false ? `${c.name}_mirrored` : smartRename(c.name);
        const origin = [...c.origin] as [number, number, number];
        origin[axisIndex] = pivot * 2 - origin[axisIndex];
        const parent =
          !c.parent || c.parent === "root"
            ? "root"
            : typeof c.parent === "string"
              ? "root"
              : c.parent;
        const neo = new Cube({
          name,
          from: lo,
          to: hi,
          origin,
          autouv: 1,
          box_uv: boxUv,
        })
          .init()
          .addTo(parent);
        neo.mapAutoUV?.();
        host.textures.defaultOrFirst()?.applyToCube(neo.uuid, true);
        const row = { uuid: neo.uuid, name: neo.name, type: "cube" };
        created.push(row);
        track.addElements([row]);
      } else {
        const g = el as Group;
        const origin = [...g.origin] as [number, number, number];
        origin[axisIndex] = pivot * 2 - origin[axisIndex];
        const name = opts.rename === false ? `${g.name}_mirrored` : smartRename(g.name);
        const parent =
          !g.parent || g.parent === "root"
            ? "root"
            : typeof g.parent === "string"
              ? "root"
              : g.parent;
        const neo = new Group({ name, origin, rotation: [0, 0, 0] })
          .init()
          .addTo(parent);
        neo.createUniqueName?.();
        const row = { uuid: neo.uuid, name: neo.name, type: "group" };
        created.push(row);
        track.addElements([row]);
      }
    }
    refreshView(created);
    return { ok: true as const, undo_label: label, created };
  });
}

function isCube(el: Group | Cube): boolean {
  return typeof (el as Cube).from !== "undefined" && typeof (el as Cube).to !== "undefined";
}

function smartRename(name: string): string {
  if (/right/i.test(name)) return name.replace(/right/gi, "left");
  if (/left/i.test(name)) return name.replace(/left/gi, "right");
  if (/_r\b/i.test(name)) return name.replace(/_r\b/i, "_l");
  if (/_l\b/i.test(name)) return name.replace(/_l\b/i, "_r");
  return `${name}_mirrored`;
}
