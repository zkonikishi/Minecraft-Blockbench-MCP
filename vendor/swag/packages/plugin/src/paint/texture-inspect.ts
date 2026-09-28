import { requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { faceLocalToAtlas } from "./face-space.js";
import {
  loadTextureCanvas,
  requireFaceSpace,
  requireTextureHandle,
} from "./texture-pixels.js";

type FaceRef = { cube: string; face: string };

function hex(data: Uint8ClampedArray, i: number): string {
  return `#${[data[i], data[i + 1], data[i + 2], data[i + 3]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export async function analyzeTexturePalette(opts: {
  texture?: string;
  face?: FaceRef;
  max_colors?: number;
}): Promise<{
  total_pixels: number;
  unique_colors: number;
  transparent_pixels: number;
  colors: Array<{ color: string; count: number; percent: number }>;
}> {
  requireProject();
  const tex = requireTextureHandle(opts.texture);
  const canvas = await loadTextureCanvas(tex);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const counts = new Map<string, number>();
  let total = 0;
  let transparent = 0;
  const visit = (x: number, y: number) => {
    const i = (y * image.width + x) * 4;
    const color = hex(image.data, i);
    counts.set(color, (counts.get(color) ?? 0) + 1);
    total += 1;
    if (image.data[i + 3] === 0) transparent += 1;
  };
  if (opts.face) {
    const { space } = requireFaceSpace(opts.face);
    for (let y = 0; y < space.height; y += 1)
      for (let x = 0; x < space.width; x += 1)
        visit(...faceLocalToAtlas(space, x, y));
  } else {
    for (let y = 0; y < image.height; y += 1)
      for (let x = 0; x < image.width; x += 1) visit(x, y);
  }
  const colors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.max_colors ?? 32)
    .map(([color, count]) => ({
      color,
      count,
      percent: total ? count / total : 0,
    }));
  return {
    total_pixels: total,
    unique_colors: counts.size,
    transparent_pixels: transparent,
    colors,
  };
}

export async function getTextureRegion(opts: {
  texture?: string;
  face?: FaceRef;
  rect?: [number, number, number, number];
  scale?: number;
  grid?: boolean;
  checkerboard?: boolean;
}): Promise<{
  width: number;
  height: number;
  source: [number, number, number, number];
  mime: string;
  data_url: string;
}> {
  requireProject();
  const tex = requireTextureHandle(opts.texture);
  const canvas = await loadTextureCanvas(tex);
  const faceTarget = opts.face ? requireFaceSpace(opts.face) : undefined;
  let rect: [number, number, number, number] = opts.rect ?? [
    0,
    0,
    canvas.width,
    canvas.height,
  ];
  if (faceTarget) {
    const { space } = faceTarget;
    const points: Array<[number, number]> = [];
    for (let y = 0; y < space.height; y += 1)
      for (let x = 0; x < space.width; x += 1)
        points.push(faceLocalToAtlas(space, x, y));
    const minX = Math.min(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    rect = [
      minX,
      minY,
      Math.max(...points.map((p) => p[0])) - minX + 1,
      Math.max(...points.map((p) => p[1])) - minY + 1,
    ];
  }
  const [x, y, w, h] = rect;
  if (x + w > canvas.width || y + h > canvas.height)
    throw new CommandError("E_INVALID_PARAM", "Region exceeds texture bounds");
  const scale = opts.scale ?? 8;
  const outputWidth = faceTarget ? faceTarget.space.width : w;
  const outputHeight = faceTarget ? faceTarget.space.height : h;
  const out = document.createElement("canvas");
  out.width = outputWidth * scale;
  out.height = outputHeight * scale;
  const ctx = out.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  if (opts.checkerboard !== false) {
    for (let py = 0; py < outputHeight; py += 1)
      for (let px = 0; px < outputWidth; px += 1) {
        ctx.fillStyle = (px + py) % 2 ? "#9aa0a6" : "#d5d8dc";
        ctx.fillRect(px * scale, py * scale, scale, scale);
      }
  }
  ctx.imageSmoothingEnabled = false;
  if (faceTarget) {
    for (let py = 0; py < faceTarget.space.height; py += 1) {
      for (let px = 0; px < faceTarget.space.width; px += 1) {
        const [ax, ay] = faceLocalToAtlas(faceTarget.space, px, py);
        ctx.drawImage(
          canvas,
          ax,
          ay,
          1,
          1,
          px * scale,
          py * scale,
          scale,
          scale,
        );
      }
    }
  } else {
    ctx.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
  }
  if (opts.grid !== false && scale >= 4) {
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 1;
    for (let px = 0; px <= outputWidth; px += 1) {
      ctx.beginPath();
      ctx.moveTo(px * scale + 0.5, 0);
      ctx.lineTo(px * scale + 0.5, out.height);
      ctx.stroke();
    }
    for (let py = 0; py <= outputHeight; py += 1) {
      ctx.beginPath();
      ctx.moveTo(0, py * scale + 0.5);
      ctx.lineTo(out.width, py * scale + 0.5);
      ctx.stroke();
    }
  }
  return {
    width: out.width,
    height: out.height,
    source: rect,
    mime: "image/png",
    data_url: out.toDataURL("image/png"),
  };
}
