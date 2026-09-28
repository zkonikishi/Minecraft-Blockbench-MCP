import { requireCube, requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";
import { cubeExtent } from "./uv-mode.js";

export const FACE_NAMES = [
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
] as const;
export type FaceName = (typeof FACE_NAMES)[number];

export type UvIsland = {
  cube: string;
  cube_uuid: string;
  face: FaceName;
  uv: [number, number, number, number];
  bounds: [number, number, number, number];
  pixel_size: [number, number];
  expected_size: [number, number];
  density: [number, number];
  flip_x: boolean;
  flip_y: boolean;
  rotation: number;
  texture: string | null;
  out_of_bounds: boolean;
};

function expectedSize(cube: Cube, face: FaceName): [number, number] {
  const { w, h, d } = cubeExtent(cube);
  if (face === "up" || face === "down") return [w, d];
  if (face === "east" || face === "west") return [d, h];
  return [w, h];
}

function textureRef(value: unknown): string | null {
  if (value === null || value === undefined || value === false) return null;
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  const record = value as { uuid?: unknown; name?: unknown };
  return typeof record.uuid === "string"
    ? record.uuid
    : typeof record.name === "string"
      ? record.name
      : "assigned";
}

export function collectUvIslands(cubes?: string[]): UvIsland[] {
  requireProject();
  const list = cubes?.length ? cubes.map(requireCube) : [...Cube.all];
  const textureWidth = Project?.texture_width ?? 16;
  const textureHeight = Project?.texture_height ?? 16;
  const islands: UvIsland[] = [];
  for (const cube of list) {
    for (const faceName of FACE_NAMES) {
      const face = cube.faces?.[faceName];
      if (!face?.uv) continue;
      const uv = [...face.uv] as [number, number, number, number];
      const bounds: [number, number, number, number] = [
        Math.min(uv[0], uv[2]),
        Math.min(uv[1], uv[3]),
        Math.max(uv[0], uv[2]),
        Math.max(uv[1], uv[3]),
      ];
      const pixelSize: [number, number] = [
        bounds[2] - bounds[0],
        bounds[3] - bounds[1],
      ];
      const expected = expectedSize(cube, faceName);
      islands.push({
        cube: cube.name,
        cube_uuid: cube.uuid,
        face: faceName,
        uv,
        bounds,
        pixel_size: pixelSize,
        expected_size: expected,
        density: [pixelSize[0] / expected[0], pixelSize[1] / expected[1]],
        flip_x: uv[2] < uv[0],
        flip_y: uv[3] < uv[1],
        rotation: (face as unknown as { rotation?: number }).rotation ?? 0,
        texture: textureRef(face.texture),
        out_of_bounds:
          bounds[0] < 0 ||
          bounds[1] < 0 ||
          bounds[2] > textureWidth ||
          bounds[3] > textureHeight,
      });
    }
  }
  return islands;
}

function intersects(a: UvIsland, b: UvIsland): boolean {
  return (
    Math.min(a.bounds[2], b.bounds[2]) - Math.max(a.bounds[0], b.bounds[0]) >
      0 &&
    Math.min(a.bounds[3], b.bounds[3]) - Math.max(a.bounds[1], b.bounds[1]) > 0
  );
}

export function getUvLayout(opts: {
  cubes?: string[];
  include_overlaps?: boolean;
  allowed_overlaps?: Array<{
    cube_a: string;
    a: FaceName;
    cube_b: string;
    b: FaceName;
  }>;
}): {
  texture_size: [number, number];
  islands: UvIsland[];
  overlaps: Array<{ a: string; b: string; intentional: boolean }>;
  summary: {
    islands: number;
    out_of_bounds: number;
    overlaps: number;
    unintended_overlaps: number;
    used: [number, number, number, number];
  };
} {
  const islands = collectUvIslands(opts.cubes);
  const allowed = new Set(
    (opts.allowed_overlaps ?? []).map(({ cube_a, a, cube_b, b }) =>
      [`${cube_a}.${a}`, `${cube_b}.${b}`].sort().join("|"),
    ),
  );
  const overlaps: Array<{ a: string; b: string; intentional: boolean }> = [];
  if (opts.include_overlaps !== false) {
    for (let i = 0; i < islands.length; i += 1) {
      for (let j = i + 1; j < islands.length; j += 1) {
        if (!intersects(islands[i], islands[j])) continue;
        const a = `${islands[i].cube}.${islands[i].face}`;
        const b = `${islands[j].cube}.${islands[j].face}`;
        overlaps.push({
          a,
          b,
          intentional: allowed.has([a, b].sort().join("|")),
        });
      }
    }
  }
  const used: [number, number, number, number] = islands.length
    ? [
        Math.min(...islands.map((island) => island.bounds[0])),
        Math.min(...islands.map((island) => island.bounds[1])),
        Math.max(...islands.map((island) => island.bounds[2])),
        Math.max(...islands.map((island) => island.bounds[3])),
      ]
    : [0, 0, 0, 0];
  return {
    texture_size: [Project?.texture_width ?? 16, Project?.texture_height ?? 16],
    islands,
    overlaps,
    summary: {
      islands: islands.length,
      out_of_bounds: islands.filter((island) => island.out_of_bounds).length,
      overlaps: overlaps.length,
      unintended_overlaps: overlaps.filter((overlap) => !overlap.intentional)
        .length,
      used,
    },
  };
}

export async function getUvMap(opts: {
  texture?: string;
  cubes?: string[];
  max_edge?: number;
  labels?: boolean;
}): Promise<{
  width: number;
  height: number;
  mime: string;
  data_url: string;
  islands: number;
}> {
  requireProject();
  const host = getHost();
  const texture = opts.texture
    ? host.textures.find(opts.texture)
    : host.textures.defaultOrFirst();
  if (opts.texture && !texture) {
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  }
  const width = Project?.texture_width ?? texture?.width ?? 16;
  const height = Project?.texture_height ?? texture?.height ?? 16;
  const scale =
    Math.min(opts.max_edge ?? 512, 1024) / Math.max(width, height, 1);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(width * scale));
  out.height = Math.max(1, Math.round(height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("No 2d context for UV map");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#20242b";
  ctx.fillRect(0, 0, out.width, out.height);
  if (texture) {
    const image = new Image();
    let loaded = false;
    await new Promise<void>((resolve) => {
      image.onload = () => {
        loaded = true;
        resolve();
      };
      image.onerror = () => resolve();
      image.src = texture.toDataURL(Math.max(width, height));
    });
    if (loaded) ctx.drawImage(image, 0, 0, out.width, out.height);
  }
  const islands = collectUvIslands(opts.cubes);
  ctx.lineWidth = Math.max(1, scale / 4);
  ctx.font = `${Math.max(8, Math.round(scale * 2))}px monospace`;
  for (let i = 0; i < islands.length; i += 1) {
    const island = islands[i];
    const hue = (i * 137.508) % 360;
    ctx.strokeStyle = `hsl(${hue} 90% 65%)`;
    ctx.strokeRect(
      island.bounds[0] * scale,
      island.bounds[1] * scale,
      island.pixel_size[0] * scale,
      island.pixel_size[1] * scale,
    );
    if (opts.labels !== false && scale >= 2) {
      ctx.fillStyle = `hsl(${hue} 90% 75%)`;
      ctx.fillText(
        `${island.cube}.${island.face}`,
        island.bounds[0] * scale + 2,
        island.bounds[1] * scale + 10,
      );
    }
  }
  return {
    width: out.width,
    height: out.height,
    mime: "image/png",
    data_url: out.toDataURL("image/png"),
    islands: islands.length,
  };
}
