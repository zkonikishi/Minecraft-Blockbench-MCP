import { requireCube, requireProject, refreshView } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { CommandError } from "../errors.js";
import { paintFaceLocal, resolveFaceSpace } from "./face-space.js";

type PaintOp = {
  type: "fill" | "rect" | "ellipse" | "line";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  color: string;
};

function applyOp(
  ctx: CanvasRenderingContext2D,
  faceW: number,
  faceH: number,
  op: PaintOp,
): void {
  ctx.fillStyle = op.color;
  ctx.strokeStyle = op.color;
  if (op.type === "fill") {
    ctx.fillRect(0, 0, faceW, faceH);
    return;
  }
  if (op.type === "line") {
    const x1 = op.x ?? 0;
    const y1 = op.y ?? 0;
    const x2 = op.x2 ?? op.x ?? 0;
    const y2 = op.y2 ?? op.y ?? 0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = Math.max(1, op.width ?? 1);
    ctx.stroke();
    return;
  }
  const x = op.x ?? 0;
  const y = op.y ?? 0;
  const w = op.width ?? 1;
  const h = op.height ?? 1;
  if (op.type === "rect") {
    ctx.fillRect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Batch face-local paint (eyes, mouth, trim) in one undo step. */
export function paintFaceFeatures(opts: {
  texture?: string;
  faces: Array<{
    cube: string;
    face: string;
    ops: PaintOp[];
  }>;
}): { ok: true; undo_label: string; painted: number } {
  requireProject();
  if (!opts.faces?.length) {
    throw new CommandError("E_INVALID_PARAM", "faces[] required");
  }
  const host = getHost();
  const tex = opts.texture
    ? host.textures.find(opts.texture)
    : host.textures.defaultOrFirst();
  if (opts.texture && !tex) {
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  }
  if (!tex) throw new CommandError("E_NOT_FOUND", "No texture available");

  const jobs = opts.faces.map((item) => {
    const cube = requireCube(item.cube);
    const face = cube.faces?.[item.face];
    if (!face) {
      throw new CommandError(
        "E_INVALID_PARAM",
        `Face not found: ${item.cube}.${item.face}`,
      );
    }
    return {
      cube,
      faceName: item.face,
      space: resolveFaceSpace(cube, item.face),
      ops: item.ops,
    };
  });

  return host.undo.run(
    { textures: [], bitmap: true, uv_only: true },
    "paint_face_features",
    (track) => {
      track.addTextures([tex]);
      for (const job of jobs) {
        tex.applyToCube(job.cube.uuid, [job.faceName]);
      }
      tex.edit((ctx) => {
        ctx.imageSmoothingEnabled = false;
        for (const job of jobs) {
          paintFaceLocal(ctx, job.space, (local) => {
            for (const op of job.ops)
              applyOp(local, job.space.width, job.space.height, op);
          });
        }
      }, "paint_face_features");
      refreshView(jobs.map((j) => ({ uuid: j.cube.uuid, name: j.cube.name })));
      return {
        ok: true as const,
        undo_label: "paint_face_features",
        painted: jobs.length,
      };
    },
  );
}

/** Back-compat single-feature wrapper. */
export function paintFaceFeature(opts: {
  cube: string;
  face: string;
  feature: "rect" | "ellipse" | "fill";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  texture?: string;
}): { ok: true; undo_label: string } {
  const op: PaintOp =
    opts.feature === "fill"
      ? { type: "fill", color: opts.color }
      : {
          type: opts.feature,
          x: opts.x,
          y: opts.y,
          width: opts.width,
          height: opts.height,
          color: opts.color,
        };
  paintFaceFeatures({
    texture: opts.texture,
    faces: [{ cube: opts.cube, face: opts.face, ops: [op] }],
  });
  return { ok: true, undo_label: "paint_face_feature" };
}
