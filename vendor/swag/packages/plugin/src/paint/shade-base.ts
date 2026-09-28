import { requireCube, requireProject, refreshView } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { CommandError } from "../errors.js";
import { blurRect, regionColorFor, shadeHex } from "./color.js";

type FaceJob = {
  x: number;
  y: number;
  w: number;
  h: number;
  base: string;
  mul: number;
};

function facePixelRect(
  face: { uv?: number[] },
  scale: number,
): { x: number; y: number; w: number; h: number } | null {
  const uv = face.uv;
  if (!uv || uv.length < 4) return null;
  const x0 = Math.min(uv[0], uv[2]) * scale;
  const y0 = Math.min(uv[1], uv[3]) * scale;
  const x1 = Math.max(uv[0], uv[2]) * scale;
  const y1 = Math.max(uv[1], uv[3]) * scale;
  const w = Math.max(1, Math.round(x1 - x0));
  const h = Math.max(1, Math.round(y1 - y0));
  return { x: Math.round(x0), y: Math.round(y0), w, h };
}

/**
 * Smooth shaded base coat (inspired by sosadly detail_cubes):
 * region colors + face lighting + soft mottle + optional blur.
 */
export function shadeModelBase(opts: {
  cubes?: string[];
  texture?: string;
  base?: string;
  regions?: Array<{ match: string; color: string }>;
  top_light?: number;
  bottom_dark?: number;
  noise?: number;
  blur?: number;
  edge_darken?: number;
  seed?: number;
  crisp?: boolean;
}): {
  ok: true;
  undo_label: string;
  textured: number;
  faces: number;
} {
  requireProject();
  const list =
    opts.cubes && opts.cubes.length > 0
      ? opts.cubes.map((n) => requireCube(n))
      : [...Cube.all];
  if (!list.length) throw new CommandError("E_NOT_FOUND", "No cubes to shade.");

  const host = getHost();
  const tex = opts.texture
    ? host.textures.find(opts.texture)
    : host.textures.defaultOrFirst();
  if (opts.texture && !tex) {
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  }
  if (!tex)
    throw new CommandError(
      "E_NOT_FOUND",
      "No texture — call ensure_texture first.",
    );

  const base = opts.base ?? "#9c9c9c";
  const mottle = opts.noise ?? 0.06;
  const blurAmt = opts.blur ?? 0.45;
  const topLight = opts.top_light ?? 0.12;
  const bottomDark = opts.bottom_dark ?? 0.22;
  const edgeDark = opts.edge_darken ?? 0;
  let randomState = (opts.seed ?? 0x9e3779b9) >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  const faceMul: Record<string, number> = {
    up: 1 + topLight,
    down: 1 - bottomDark,
    north: 0.95,
    south: 1.0,
    east: 1.06,
    west: 0.88,
  };

  const Project = (
    globalThis as unknown as {
      Project?: { texture_width?: number };
    }
  ).Project;
  const scale = tex.width / (Project?.texture_width || tex.width || 64);

  return host.undo.run(
    { elements: list, textures: [], bitmap: true, uv_only: true },
    "shade_model_base",
    (track) => {
      track.addTextures([tex]);
      const jobs: FaceJob[] = [];
      for (const cube of list) {
        const col = regionColorFor(cube.name, opts.regions, base);
        tex.applyToCube(cube.uuid, true);
        for (const dir of Object.keys(cube.faces ?? {})) {
          const face = cube.faces[dir];
          if (!face) continue;
          const r = facePixelRect(face, scale);
          if (!r) continue;
          jobs.push({
            ...r,
            base: col,
            mul: faceMul[dir] ?? 1,
          });
        }
      }

      tex.edit((ctx) => {
        ctx.imageSmoothingEnabled = false;
        for (const job of jobs) {
          if (opts.crisp === true) {
            ctx.fillStyle = shadeHex(job.base, job.mul);
          } else {
            const g = ctx.createLinearGradient(0, job.y, 0, job.y + job.h);
            g.addColorStop(0, shadeHex(job.base, job.mul * 1.1));
            g.addColorStop(1, shadeHex(job.base, job.mul * 0.84));
            ctx.fillStyle = g;
          }
          ctx.fillRect(job.x, job.y, job.w, job.h);
          if (edgeDark > 0 && job.w > 2 && job.h > 2) {
            ctx.fillStyle = shadeHex(job.base, job.mul * (1 - edgeDark));
            ctx.fillRect(job.x, job.y, job.w, 1);
            ctx.fillRect(job.x, job.y + job.h - 1, job.w, 1);
            ctx.fillRect(job.x, job.y, 1, job.h);
            ctx.fillRect(job.x + job.w - 1, job.y, 1, job.h);
          }
        }
        if (mottle > 0) {
          for (const job of jobs) {
            const count = Math.max(1, Math.floor(job.w * job.h * 0.1));
            for (let i = 0; i < count; i++) {
              const px = job.x + ((random() * job.w) | 0);
              const py = job.y + ((random() * job.h) | 0);
              ctx.fillStyle = shadeHex(
                job.base,
                job.mul * (1 - mottle + random() * mottle * 2),
              );
              ctx.fillRect(
                px,
                py,
                1,
                opts.crisp === true || random() < 0.5 ? 1 : 2,
              );
            }
          }
        }
        if (blurAmt > 0 && opts.crisp !== true) {
          for (const job of jobs)
            blurRect(ctx, job.x, job.y, job.w, job.h, blurAmt);
        }
      }, "shade_model_base");

      refreshView(list.map((c) => ({ uuid: c.uuid, name: c.name })));
      return {
        ok: true as const,
        undo_label: "shade_model_base",
        textured: list.length,
        faces: jobs.length,
      };
    },
  );
}
