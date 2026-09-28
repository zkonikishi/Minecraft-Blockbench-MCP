import type { TextureHandle, TexturePort } from "./ports.js";
import { CommandError } from "../errors.js";

type BbTexture = {
  uuid: string;
  name: string;
  width: number;
  height: number;
  canvas?: HTMLCanvasElement;
  ctx?: CanvasRenderingContext2D;
  fromDataURL: (url: string) => BbTexture;
  add: (undo?: boolean) => BbTexture;
  edit: (
    cb: (canvas: HTMLCanvasElement) => void,
    opts?: { edit_name?: string },
  ) => void;
  updateChangesAfterEdit?: () => void;
};

type TextureCtor = {
  new (data?: { name?: string }): BbTexture;
  all: BbTexture[];
  getDefault?: () => BbTexture | undefined;
};

function textureApi(): TextureCtor {
  const T = (globalThis as unknown as { Texture?: TextureCtor }).Texture;
  if (!T)
    throw new CommandError("E_BLOCKBENCH_ERROR", "Texture API unavailable");
  return T;
}

function wrap(tex: BbTexture): TextureHandle {
  return {
    uuid: tex.uuid,
    name: tex.name,
    width: tex.width,
    height: tex.height,
    edit(paint, editName) {
      if (typeof tex.edit === "function") {
        tex.edit(
          (canvas) => {
            const ctx = canvas.getContext("2d") ?? tex.ctx;
            if (!ctx) {
              throw new CommandError(
                "E_BLOCKBENCH_ERROR",
                "Texture canvas has no 2d context",
              );
            }
            paint(ctx, canvas);
          },
          { edit_name: editName },
        );
        tex.updateChangesAfterEdit?.();
        return;
      }
      const canvas = tex.canvas;
      const ctx = canvas?.getContext("2d") ?? tex.ctx;
      if (!canvas || !ctx) {
        throw new CommandError(
          "E_BLOCKBENCH_ERROR",
          "Texture.edit unavailable",
        );
      }
      paint(ctx, canvas);
      tex.updateChangesAfterEdit?.();
    },
    applyToCube(cubeUuid, faces = true) {
      const Cube = (
        globalThis as unknown as {
          Cube?: {
            all: Array<{
              uuid: string;
              applyTexture: (t: BbTexture, f?: true | string[]) => void;
            }>;
          };
        }
      ).Cube;
      const cube = Cube?.all.find((c) => c.uuid === cubeUuid);
      if (!cube) throw new CommandError("E_NOT_FOUND", `Cube ${cubeUuid}`);
      cube.applyTexture(tex, faces);
    },
    toDataURL(maxEdge = 256) {
      const src =
        tex.canvas ??
        (() => {
          throw new CommandError(
            "E_BLOCKBENCH_ERROR",
            "Texture has no canvas for export",
          );
        })();
      const w = src.width || tex.width;
      const h = src.height || tex.height;
      const scale = Math.min(1, maxEdge / Math.max(w, h, 1));
      if (scale >= 0.999) return src.toDataURL("image/png");
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(w * scale));
      out.height = Math.max(1, Math.round(h * scale));
      const ctx = out.getContext("2d");
      if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, out.width, out.height);
      return out.toDataURL("image/png");
    },
  };
}

function solidDataUrl(width: number, height: number, fill: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL("image/png");
}

export function createTexturePort(): TexturePort {
  return {
    find(ref) {
      const T = textureApi();
      const hit = T.all.find((t) => t.uuid === ref || t.name === ref);
      return hit ? wrap(hit) : undefined;
    },
    defaultOrFirst() {
      const T = textureApi();
      const hit = T.getDefault?.() ?? T.all[0];
      return hit ? wrap(hit) : undefined;
    },
    list() {
      return textureApi().all.map(wrap);
    },
    ensure(opts) {
      const T = textureApi();
      const existing = T.all.find((t) => t.name === opts.name);
      if (existing) return wrap(existing);
      const dataUrl = solidDataUrl(opts.width, opts.height, opts.fill);
      const tex = new T({ name: opts.name });
      if (typeof tex.fromDataURL !== "function") {
        throw new CommandError(
          "E_BLOCKBENCH_ERROR",
          "Texture.fromDataURL missing — need Blockbench ≥ 5.1",
        );
      }
      tex.fromDataURL(dataUrl);
      // Blockbench decodes data URLs asynchronously. Keep the public texture
      // metadata usable immediately so a create -> assign/paint sequence does
      // not transiently report 0x0 dimensions.
      tex.width = opts.width;
      tex.height = opts.height;
      // undo:false — caller owns Undo via UndoPort
      tex.add(false);
      // Texture creation is not project resizing. In particular, helper maps
      // (emissive masks, palette swatches, decals) may deliberately differ in
      // size. resize_texture/set_project_meta own that explicit operation.
      return wrap(tex);
    },
  };
}
