import { requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { faceLocalToAtlas } from "./face-space.js";
import {
  loadTextureCanvas,
  requireFaceSpace,
  requireTextureHandle,
} from "./texture-pixels.js";
import { textureRevision } from "./texture-revision.js";
import { FACE_NAMES } from "./uv-layout.js";

type FaceRef = { cube: string; face: string };
type Finding = {
  severity: "error" | "warn" | "info";
  code: string;
  face: string;
  message: string;
};

function rgbaKey(data: Uint8ClampedArray, index: number): string {
  return `${data[index]},${data[index + 1]},${data[index + 2]},${data[index + 3]}`;
}

export async function auditTextureQuality(opts: {
  texture?: string;
  faces?: FaceRef[];
  palette_limit?: number;
  min_base_ratio?: number;
  glass?: boolean;
}): Promise<{
  texture: string;
  revision: string;
  faces: number;
  findings: Finding[];
  summary: { errors: number; warns: number; infos: number };
}> {
  requireProject();
  const texture = requireTextureHandle(opts.texture);
  const canvas = await loadTextureCanvas(texture);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const refs =
    opts.faces ??
    Cube.all.flatMap((cube) =>
      FACE_NAMES.filter((face) => cube.faces?.[face]).map((face) => ({
        cube: cube.uuid,
        face,
      })),
    );
  const findings: Finding[] = [];
  for (const ref of refs) {
    const { cube, space } = requireFaceSpace(ref);
    const label = `${cube.name}.${ref.face}`;
    const colors = new Map<string, number>();
    const alpha: number[][] = [];
    let isolated = 0;
    let transparent = 0;
    for (let y = 0; y < space.height; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < space.width; x += 1) {
        const [ax, ay] = faceLocalToAtlas(space, x, y);
        const i = (ay * image.width + ax) * 4;
        const key = rgbaKey(image.data, i);
        colors.set(key, (colors.get(key) ?? 0) + 1);
        row.push(image.data[i + 3]);
        if (image.data[i + 3] === 0) transparent += 1;
      }
      alpha.push(row);
    }
    const pixels = space.width * space.height;
    const dominant = Math.max(...colors.values());
    const baseRatio = dominant / pixels;
    const paletteLimit = opts.palette_limit ?? 8;
    if (transparent === pixels) {
      findings.push({
        severity: "error",
        code: "EMPTY_FACE_TEXTURE",
        face: label,
        message: "Face is fully transparent and will not be visible.",
      });
    } else if (!opts.glass && transparent > 0) {
      findings.push({
        severity: "info",
        code: "PARTIAL_TRANSPARENCY",
        face: label,
        message: `${((transparent / pixels) * 100).toFixed(1)}% of texels are fully transparent; verify holes are intentional.`,
      });
    }
    if (colors.size > paletteLimit) {
      findings.push({
        severity: "warn",
        code: "PALETTE_EXCESS",
        face: label,
        message: `${colors.size} exact RGBA colors exceed palette_limit ${paletteLimit}.`,
      });
    }
    if (baseRatio < (opts.min_base_ratio ?? 0.6)) {
      findings.push({
        severity: "warn",
        code: "WEAK_BASE_COLOR",
        face: label,
        message: `Dominant color covers only ${(baseRatio * 100).toFixed(1)}%; material may read as noisy.`,
      });
    }
    for (let y = 0; y < space.height; y += 1) {
      for (let x = 0; x < space.width; x += 1) {
        if (alpha[y][x] === 0) continue;
        let neighbors = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (alpha[y + dy]?.[x + dx] > 0) neighbors += 1;
        }
        if (neighbors === 0) isolated += 1;
      }
    }
    if (isolated > Math.max(1, pixels * 0.02)) {
      findings.push({
        severity: "info",
        code: "ISOLATED_PIXELS",
        face: label,
        message: `${isolated} opaque pixels have no orthogonal neighbor; verify intentional sparkles/details.`,
      });
    }
    if (colors.size === 1) {
      findings.push({
        severity: "info",
        code: "FLAT_FACE",
        face: label,
        message:
          "Face is a uniform fill; verify that flat material is intentional.",
      });
    }
    if (opts.glass) {
      let edgeAlpha = 0;
      let edgeCount = 0;
      let centerAlpha = 0;
      let centerCount = 0;
      let opaque = 0;
      for (let y = 0; y < space.height; y += 1)
        for (let x = 0; x < space.width; x += 1) {
          const value = alpha[y][x];
          if (value >= 230) opaque += 1;
          if (
            x === 0 ||
            y === 0 ||
            x === space.width - 1 ||
            y === space.height - 1
          ) {
            edgeAlpha += value;
            edgeCount += 1;
          } else {
            centerAlpha += value;
            centerCount += 1;
          }
        }
      const edgeMean = edgeAlpha / Math.max(1, edgeCount);
      const centerMean = centerAlpha / Math.max(1, centerCount);
      if (edgeMean <= centerMean)
        findings.push({
          severity: "warn",
          code: "GLASS_EDGE_WEAK",
          face: label,
          message:
            "Glass edges are not more opaque than the center; hollow form may disappear.",
        });
      if (opaque / pixels > 0.35)
        findings.push({
          severity: "warn",
          code: "GLASS_TOO_OPAQUE",
          face: label,
          message: `${((opaque / pixels) * 100).toFixed(1)}% of texels are near-opaque.`,
        });
    }
  }
  return {
    texture: texture.name,
    revision: await textureRevision(texture),
    faces: refs.length,
    findings,
    summary: {
      errors: findings.filter((f) => f.severity === "error").length,
      warns: findings.filter((f) => f.severity === "warn").length,
      infos: findings.filter((f) => f.severity === "info").length,
    },
  };
}
