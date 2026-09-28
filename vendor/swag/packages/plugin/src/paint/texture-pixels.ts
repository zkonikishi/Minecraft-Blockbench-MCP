import { requireCube, requireProject, refreshView } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";
import type { TextureHandle } from "../host/ports.js";
import {
  faceLocalToAtlas,
  resolveFaceSpace,
  type FaceSpace,
} from "./face-space.js";
import {
  assertTextureRevision,
  revisionFromPixels,
  textureRevision,
} from "./texture-revision.js";

type FaceRef = { cube: string; face: string };
type Rgba = [number, number, number, number];

function texture(ref?: string): TextureHandle {
  const host = getHost();
  const hit = ref ? host.textures.find(ref) : host.textures.defaultOrFirst();
  if (!hit) {
    throw new CommandError(
      "E_NOT_FOUND",
      ref ? `Texture not found: ${ref}` : "No texture available",
    );
  }
  return hit;
}

function faceSpace(ref: FaceRef): { cube: Cube; space: FaceSpace } {
  const cube = requireCube(ref.cube);
  if (!cube.faces?.[ref.face]) {
    throw new CommandError(
      "E_NOT_FOUND",
      `Face not found: ${ref.cube}.${ref.face}`,
    );
  }
  return { cube, space: resolveFaceSpace(cube, ref.face) };
}

function parseColor(value: string): Rgba {
  if (typeof CSS !== "undefined" && !CSS.supports("color", value)) {
    throw new CommandError("E_INVALID_PARAM", `Invalid CSS color: ${value}`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000000";
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const p = ctx.getImageData(0, 0, 1, 1).data;
  return [p[0], p[1], p[2], p[3]];
}

function rgbaHex(rgba: Rgba): string {
  return `#${rgba.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function setPixel(data: ImageData, x: number, y: number, rgba: Rgba): boolean {
  if (x < 0 || y < 0 || x >= data.width || y >= data.height) return false;
  const i = (y * data.width + x) * 4;
  data.data.set(rgba, i);
  return true;
}

function pixel(data: ImageData, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= data.width || y >= data.height)
    return [0, 0, 0, 0];
  const i = (y * data.width + x) * 4;
  return [data.data[i], data.data[i + 1], data.data[i + 2], data.data[i + 3]];
}

async function loadCanvas(tex: TextureHandle): Promise<HTMLCanvasElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new CommandError("E_BLOCKBENCH_ERROR", "Texture decode failed"));
    image.src = tex.toDataURL(Math.max(tex.width, tex.height));
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return canvas;
}

function assertGrid(rows: string[], space: FaceSpace): string[][] {
  const grid = rows.map((row) => Array.from(row));
  if (
    grid.length !== space.height ||
    grid.some((row) => row.length !== space.width)
  ) {
    throw new CommandError(
      "E_INVALID_PARAM",
      `Grid must be exactly ${space.width}×${space.height} face-local texels`,
    );
  }
  return grid;
}

export async function paintFaceGrid(opts: {
  texture?: string;
  expected_revision?: string;
  faces: Array<FaceRef & { rows: string[] }>;
  palette: Record<string, string | null>;
}): Promise<{
  ok: true;
  undo_label: string;
  faces: number;
  pixels: number;
  revision: string;
}> {
  requireProject();
  const tex = texture(opts.texture);
  await assertTextureRevision(tex, opts.expected_revision);
  const palette = new Map<string, Rgba>();
  for (const [symbol, color] of Object.entries(opts.palette)) {
    if (Array.from(symbol).length !== 1) {
      throw new CommandError(
        "E_INVALID_PARAM",
        `Palette key must be one symbol: ${symbol}`,
      );
    }
    palette.set(symbol, color === null ? [0, 0, 0, 0] : parseColor(color));
  }
  const jobs = opts.faces.map((item) => {
    const target = faceSpace(item);
    return {
      ...target,
      face: item.face,
      grid: assertGrid(item.rows, target.space),
    };
  });
  let count = 0;
  const result = getHost().undo.run(
    {
      elements: jobs.map((j) => j.cube),
      textures: [tex],
      bitmap: true,
      uv_only: true,
    },
    "paint_face_grid",
    (track) => {
      track.addTextures([tex]);
      for (const job of jobs) tex.applyToCube(job.cube.uuid, [job.face]);
      tex.edit((ctx, canvas) => {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (const job of jobs) {
          for (let y = 0; y < job.space.height; y += 1) {
            for (let x = 0; x < job.space.width; x += 1) {
              const symbol = job.grid[y][x];
              const color = palette.get(symbol);
              if (!color)
                throw new CommandError(
                  "E_INVALID_PARAM",
                  `Unknown palette symbol: ${symbol}`,
                );
              const [ax, ay] = faceLocalToAtlas(job.space, x, y);
              if (!setPixel(image, ax, ay, color)) {
                throw new CommandError(
                  "E_INVALID_PARAM",
                  `Mapped pixel outside atlas: ${ax},${ay}`,
                );
              }
              count += 1;
            }
          }
        }
        ctx.putImageData(image, 0, 0);
      }, "paint_face_grid");
      refreshView(jobs.map((j) => j.cube));
      return {
        ok: true as const,
        undo_label: "paint_face_grid",
        faces: jobs.length,
        pixels: count,
      };
    },
  );
  return { ...result, revision: await textureRevision(tex) };
}

export async function getFaceGrid(
  opts: FaceRef & { texture?: string },
): Promise<{
  cube: string;
  face: string;
  width: number;
  height: number;
  rows: string[][];
  revision: string;
}> {
  requireProject();
  const tex = texture(opts.texture);
  const { space } = faceSpace(opts);
  const canvas = await loadCanvas(tex);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rows: string[][] = [];
  for (let y = 0; y < space.height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < space.width; x += 1) {
      const [ax, ay] = faceLocalToAtlas(space, x, y);
      row.push(rgbaHex(pixel(image, ax, ay)));
    }
    rows.push(row);
  }
  return {
    cube: opts.cube,
    face: opts.face,
    width: space.width,
    height: space.height,
    rows,
    revision: revisionFromPixels(image.data, image.width, image.height),
  };
}

export async function editTexturePixels(opts: {
  texture?: string;
  expected_revision?: string;
  face?: FaceRef;
  pixels: Array<{ x: number; y: number; color: string | null }>;
}): Promise<{
  ok: true;
  undo_label: string;
  changed: number;
  revision: string;
}> {
  requireProject();
  const tex = texture(opts.texture);
  await assertTextureRevision(tex, opts.expected_revision);
  const target = opts.face ? faceSpace(opts.face) : undefined;
  const colors = opts.pixels.map((p) => ({
    ...p,
    rgba: p.color === null ? ([0, 0, 0, 0] as Rgba) : parseColor(p.color),
  }));
  let changed = 0;
  const result = getHost().undo.run(
    { textures: [tex], bitmap: true },
    "edit_texture_pixels",
    (track) => {
      track.addTextures([tex]);
      tex.edit((ctx, canvas) => {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (const p of colors) {
          if (
            target &&
            (p.x >= target.space.width || p.y >= target.space.height)
          ) {
            throw new CommandError(
              "E_INVALID_PARAM",
              `Face-local pixel outside ${target.space.width}×${target.space.height}: ${p.x},${p.y}`,
            );
          }
          const [x, y] = target
            ? faceLocalToAtlas(target.space, p.x, p.y)
            : [p.x, p.y];
          if (!setPixel(image, x, y, p.rgba))
            throw new CommandError(
              "E_INVALID_PARAM",
              `Pixel outside target: ${p.x},${p.y}`,
            );
          changed += 1;
        }
        ctx.putImageData(image, 0, 0);
      }, "edit_texture_pixels");
      if (target) refreshView([target.cube]);
      else getHost().canvas.updateAll();
      return { ok: true as const, undo_label: "edit_texture_pixels", changed };
    },
  );
  return { ...result, revision: await textureRevision(tex) };
}

export async function replaceTextureColor(opts: {
  texture?: string;
  expected_revision?: string;
  face?: FaceRef;
  from: string;
  to: string | null;
  tolerance?: number;
}): Promise<{
  ok: true;
  undo_label: string;
  replaced: number;
  revision: string;
}> {
  requireProject();
  const tex = texture(opts.texture);
  await assertTextureRevision(tex, opts.expected_revision);
  const target = opts.face ? faceSpace(opts.face) : undefined;
  const from = parseColor(opts.from);
  const to = opts.to === null ? ([0, 0, 0, 0] as Rgba) : parseColor(opts.to);
  const tolerance = opts.tolerance ?? 0;
  let replaced = 0;
  const matches = (p: Rgba) =>
    p.every((value, i) => Math.abs(value - from[i]) <= tolerance);
  const result = getHost().undo.run(
    { textures: [tex], bitmap: true },
    "replace_texture_color",
    (track) => {
      track.addTextures([tex]);
      tex.edit((ctx, canvas) => {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const visit = (x: number, y: number) => {
          if (!matches(pixel(image, x, y))) return;
          setPixel(image, x, y, to);
          replaced += 1;
        };
        if (target) {
          for (let y = 0; y < target.space.height; y += 1)
            for (let x = 0; x < target.space.width; x += 1)
              visit(...faceLocalToAtlas(target.space, x, y));
        } else {
          for (let y = 0; y < image.height; y += 1)
            for (let x = 0; x < image.width; x += 1) visit(x, y);
        }
        ctx.putImageData(image, 0, 0);
      }, "replace_texture_color");
      getHost().canvas.updateAll();
      return {
        ok: true as const,
        undo_label: "replace_texture_color",
        replaced,
      };
    },
  );
  return { ...result, revision: await textureRevision(tex) };
}

export async function copyFacePixels(opts: {
  texture?: string;
  expected_revision?: string;
  source: FaceRef;
  target: FaceRef;
  flip_x?: boolean;
  flip_y?: boolean;
  rotation?: "0" | "90" | "180" | "270";
}): Promise<{
  ok: true;
  undo_label: string;
  pixels: number;
  revision: string;
}> {
  requireProject();
  const tex = texture(opts.texture);
  await assertTextureRevision(tex, opts.expected_revision);
  const source = faceSpace(opts.source);
  const target = faceSpace(opts.target);
  const rotation = Number(opts.rotation ?? "0");
  const turns = rotation === 90 || rotation === 270;
  const expectedW = turns ? source.space.height : source.space.width;
  const expectedH = turns ? source.space.width : source.space.height;
  if (target.space.width !== expectedW || target.space.height !== expectedH) {
    throw new CommandError(
      "E_INVALID_PARAM",
      `Target face must be ${expectedW}×${expectedH} after rotation`,
    );
  }
  const canvas = await loadCanvas(tex);
  const sourceCtx = canvas.getContext("2d");
  if (!sourceCtx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  const snapshot = sourceCtx.getImageData(0, 0, canvas.width, canvas.height);
  const colors: Rgba[][] = [];
  for (let y = 0; y < source.space.height; y += 1) {
    const row: Rgba[] = [];
    for (let x = 0; x < source.space.width; x += 1)
      row.push(pixel(snapshot, ...faceLocalToAtlas(source.space, x, y)));
    colors.push(row);
  }
  const result = getHost().undo.run(
    { textures: [tex], bitmap: true },
    "copy_face_pixels",
    (track) => {
      track.addTextures([tex]);
      tex.applyToCube(target.cube.uuid, [opts.target.face]);
      tex.edit((ctx, output) => {
        const image = ctx.getImageData(0, 0, output.width, output.height);
        for (let sy = 0; sy < source.space.height; sy += 1) {
          for (let sx = 0; sx < source.space.width; sx += 1) {
            const fx = opts.flip_x ? source.space.width - 1 - sx : sx;
            const fy = opts.flip_y ? source.space.height - 1 - sy : sy;
            let tx = fx;
            let ty = fy;
            if (rotation === 90) {
              tx = source.space.height - 1 - fy;
              ty = fx;
            } else if (rotation === 180) {
              tx = source.space.width - 1 - fx;
              ty = source.space.height - 1 - fy;
            } else if (rotation === 270) {
              tx = fy;
              ty = source.space.width - 1 - fx;
            }
            setPixel(
              image,
              ...faceLocalToAtlas(target.space, tx, ty),
              colors[sy][sx],
            );
          }
        }
        ctx.putImageData(image, 0, 0);
      }, "copy_face_pixels");
      refreshView([target.cube]);
      return {
        ok: true as const,
        undo_label: "copy_face_pixels",
        pixels: source.space.width * source.space.height,
      };
    },
  );
  return { ...result, revision: await textureRevision(tex) };
}

export {
  texture as requireTextureHandle,
  faceSpace as requireFaceSpace,
  loadCanvas as loadTextureCanvas,
  rgbaHex,
};
