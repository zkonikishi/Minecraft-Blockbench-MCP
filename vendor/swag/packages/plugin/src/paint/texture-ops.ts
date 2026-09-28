import { requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";
import { faceLocalToAtlas } from "./face-space.js";
import { assertTextureRevision, textureRevision } from "./texture-revision.js";
import { requireFaceSpace, requireTextureHandle } from "./texture-pixels.js";

type FaceRef = { cube: string; face: string };
type Rgba = [number, number, number, number];

function color(value: string | null): Rgba {
  if (value === null) return [0, 0, 0, 0];
  if (typeof CSS !== "undefined" && !CSS.supports("color", value))
    throw new CommandError("E_INVALID_PARAM", `Invalid CSS color: ${value}`);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const p = ctx.getImageData(0, 0, 1, 1).data;
  return [p[0], p[1], p[2], p[3]];
}

function read(data: ImageData, x: number, y: number): Rgba {
  const i = (y * data.width + x) * 4;
  return [data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3]];
}
function write(data: ImageData, x: number, y: number, p: Rgba): void {
  data.data.set(p, (y * data.width + x) * 4);
}
function close(a: Rgba, b: Rgba, tolerance: number): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
}

export async function floodFillTexture(opts: {
  texture?: string;
  expected_revision?: string;
  face?: FaceRef;
  x: number;
  y: number;
  color: string | null;
  tolerance?: number;
  diagonal?: boolean;
  max_pixels?: number;
}): Promise<{
  ok: true;
  undo_label: string;
  filled: number;
  revision: string;
}> {
  requireProject();
  const texture = requireTextureHandle(opts.texture);
  await assertTextureRevision(texture, opts.expected_revision);
  const face = opts.face ? requireFaceSpace(opts.face) : undefined;
  const width = face?.space.width ?? texture.width;
  const height = face?.space.height ?? texture.height;
  if (opts.x >= width || opts.y >= height)
    throw new CommandError(
      "E_INVALID_PARAM",
      `Seed outside ${width}×${height}`,
    );
  const target = color(opts.color);
  const tolerance = opts.tolerance ?? 0;
  const cap = opts.max_pixels ?? 65536;
  let filled = 0;
  const result = getHost().undo.run(
    { textures: [texture], bitmap: true },
    "flood_fill_texture",
    (track) => {
      track.addTextures([texture]);
      texture.edit((ctx, canvas) => {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const atlas = (x: number, y: number): [number, number] =>
          face ? faceLocalToAtlas(face.space, x, y) : [x, y];
        const start = read(image, ...atlas(opts.x, opts.y));
        if (close(start, target, 0)) return;
        const queue: Array<[number, number]> = [[opts.x, opts.y]];
        const seen = new Uint8Array(width * height);
        const neighbors = opts.diagonal
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [1, 1],
              [-1, 1],
              [1, -1],
              [-1, -1],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ];
        for (let head = 0; head < queue.length; head += 1) {
          const [x, y] = queue[head];
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const key = y * width + x;
          if (seen[key]) continue;
          seen[key] = 1;
          const point = atlas(x, y);
          if (!close(read(image, ...point), start, tolerance)) continue;
          write(image, ...point, target);
          filled += 1;
          if (filled > cap)
            throw new CommandError(
              "E_INVALID_PARAM",
              `Flood fill exceeds max_pixels ${cap}`,
            );
          for (const [dx, dy] of neighbors) queue.push([x + dx, y + dy]);
        }
        ctx.putImageData(image, 0, 0);
      }, "flood_fill_texture");
      getHost().canvas.updateAll();
      return { ok: true as const, undo_label: "flood_fill_texture", filled };
    },
  );
  return { ...result, revision: await textureRevision(texture) };
}

export async function transformTextureRegion(opts: {
  texture?: string;
  expected_revision?: string;
  face?: FaceRef;
  rect?: [number, number, number, number];
  operation: "flip_x" | "flip_y" | "rotate_180" | "rotate_90" | "rotate_270";
}): Promise<{
  ok: true;
  undo_label: string;
  pixels: number;
  revision: string;
}> {
  requireProject();
  const texture = requireTextureHandle(opts.texture);
  await assertTextureRevision(texture, opts.expected_revision);
  const face = opts.face ? requireFaceSpace(opts.face) : undefined;
  const rect = opts.rect ?? [0, 0, face!.space.width, face!.space.height];
  const [rx, ry, w, h] = rect;
  if (face && (rx !== 0 || ry !== 0))
    throw new CommandError(
      "E_INVALID_PARAM",
      "Face transforms use the full face",
    );
  if (
    (opts.operation === "rotate_90" || opts.operation === "rotate_270") &&
    w !== h
  )
    throw new CommandError(
      "E_INVALID_PARAM",
      "Quarter-turn region must be square",
    );
  const result = getHost().undo.run(
    { textures: [texture], bitmap: true },
    "transform_texture_region",
    (track) => {
      track.addTextures([texture]);
      texture.edit((ctx, canvas) => {
        if (!face && (rx + w > canvas.width || ry + h > canvas.height))
          throw new CommandError(
            "E_INVALID_PARAM",
            "Region exceeds texture bounds",
          );
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const atlas = (x: number, y: number): [number, number] =>
          face ? faceLocalToAtlas(face.space, x, y) : [rx + x, ry + y];
        const source: Rgba[][] = [];
        for (let y = 0; y < h; y += 1) {
          const row: Rgba[] = [];
          for (let x = 0; x < w; x += 1) row.push(read(image, ...atlas(x, y)));
          source.push(row);
        }
        for (let y = 0; y < h; y += 1)
          for (let x = 0; x < w; x += 1) {
            let sx = x;
            let sy = y;
            if (opts.operation === "flip_x") sx = w - 1 - x;
            else if (opts.operation === "flip_y") sy = h - 1 - y;
            else if (opts.operation === "rotate_180") {
              sx = w - 1 - x;
              sy = h - 1 - y;
            } else if (opts.operation === "rotate_90") {
              sx = y;
              sy = h - 1 - x;
            } else {
              sx = w - 1 - y;
              sy = x;
            }
            write(image, ...atlas(x, y), source[sy][sx]);
          }
        ctx.putImageData(image, 0, 0);
      }, "transform_texture_region");
      getHost().canvas.updateAll();
      return {
        ok: true as const,
        undo_label: "transform_texture_region",
        pixels: w * h,
      };
    },
  );
  return { ...result, revision: await textureRevision(texture) };
}
