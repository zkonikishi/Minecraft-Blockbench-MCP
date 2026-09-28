import { resolveUvModeFromHints, type UvMode } from "@blockbench-mcp/shared";
import { currentFormatId } from "../bb/elements.js";

export type { UvMode };

/** Live project UV mode: Project / Format / cubes / format-id heuristics. */
export function resolveUvMode(opts?: {
  explicit?: UvMode | "auto" | null;
  cubes?: Cube[];
}): UvMode {
  const cubes = opts?.cubes;
  return resolveUvModeFromHints({
    explicit: opts?.explicit,
    projectBoxUv: typeof Project?.box_uv === "boolean" ? Project.box_uv : null,
    formatBoxUv: typeof Format?.box_uv === "boolean" ? Format.box_uv : null,
    formatId: currentFormatId() ?? Format?.id ?? null,
    cubeBoxFlags: cubes?.map((c) => Boolean(c.box_uv)),
  });
}

export function cubeExtent(cube: Cube): { w: number; h: number; d: number } {
  return {
    w: Math.max(1, Math.ceil(Math.abs(cube.to[0] - cube.from[0]))),
    h: Math.max(1, Math.ceil(Math.abs(cube.to[1] - cube.from[1]))),
    d: Math.max(1, Math.ceil(Math.abs(cube.to[2] - cube.from[2]))),
  };
}

const FACE_DIRS = ["north", "east", "south", "west", "up", "down"] as const;

function faceFootprint(
  w: number,
  h: number,
  d: number,
  face: (typeof FACE_DIRS)[number],
): { fw: number; fh: number } {
  if (face === "up" || face === "down") return { fw: w, fh: d };
  if (face === "east" || face === "west") return { fw: d, fh: h };
  return { fw: w, fh: h };
}

type Shelf = { x: number; y: number; rowH: number; maxX: number; maxY: number };

function shelfPlace(
  shelf: Shelf,
  fw: number,
  fh: number,
  texW: number,
  pad: number,
): { x: number; y: number } {
  if (shelf.x + fw + pad > texW && shelf.x > 0) {
    shelf.x = 0;
    shelf.y += shelf.rowH + pad;
    shelf.rowH = 0;
  }
  const x = shelf.x;
  const y = shelf.y;
  shelf.x += fw + pad;
  shelf.rowH = Math.max(shelf.rowH, fh);
  shelf.maxX = Math.max(shelf.maxX, shelf.x);
  shelf.maxY = Math.max(shelf.maxY, shelf.y + shelf.rowH);
  return { x, y };
}

/** Apply unique atlas islands for the resolved UV mode. */
export function applyPackedUvs(
  cubes: Cube[],
  opts: {
    mode: UvMode;
    texW: number;
    padding?: number;
    startY?: number;
  },
): { used: [number, number]; packed: number } {
  const pad = opts.padding ?? 1;
  const startY = opts.startY ?? 0;
  const shelf: Shelf = { x: 0, y: startY, rowH: 0, maxX: 0, maxY: startY };

  if (opts.mode === "box") {
    const items = cubes
      .map((c) => {
        const { w, h, d } = cubeExtent(c);
        return { c, fw: 2 * (w + d), fh: h + d };
      })
      .sort((a, b) => b.fh - a.fh || b.fw - a.fw);
    for (const it of items) {
      const { x, y } = shelfPlace(shelf, it.fw, it.fh, opts.texW, pad);
      it.c.box_uv = true;
      it.c.uv_offset = [x, y];
      it.c.autouv = 0;
      it.c.mapAutoUV?.();
    }
  } else {
    type FaceItem = {
      c: Cube;
      face: (typeof FACE_DIRS)[number];
      fw: number;
      fh: number;
    };
    const items: FaceItem[] = [];
    for (const c of cubes) {
      const { w, h, d } = cubeExtent(c);
      c.box_uv = false;
      c.autouv = 0;
      for (const face of FACE_DIRS) {
        const { fw, fh } = faceFootprint(w, h, d, face);
        items.push({ c, face, fw, fh });
      }
    }
    items.sort((a, b) => b.fh - a.fh || b.fw - a.fw);
    for (const it of items) {
      const { x, y } = shelfPlace(shelf, it.fw, it.fh, opts.texW, pad);
      const face = it.c.faces?.[it.face];
      if (!face) continue;
      face.uv = [x, y, x + it.fw, y + it.fh];
    }
  }

  return {
    used: [shelf.maxX, shelf.maxY],
    packed: cubes.length,
  };
}
