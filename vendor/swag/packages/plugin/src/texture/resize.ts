import { requireProject, refreshView } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";

export function resizeTexture(opts: {
  texture?: string;
  width: number;
  height: number;
  rescale_uvs?: boolean;
}): {
  ok: true;
  undo_label: string;
  size: [number, number];
  uv_scale: [number, number];
} {
  requireProject();
  const host = getHost();
  const texture = opts.texture
    ? host.textures.find(opts.texture)
    : host.textures.defaultOrFirst();
  if (opts.texture && !texture) {
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  }
  if (!texture) throw new CommandError("E_NOT_FOUND", "No texture available");
  const oldWidth = Project?.texture_width ?? texture.width;
  const oldHeight = Project?.texture_height ?? texture.height;
  const scaleX = opts.width / oldWidth;
  const scaleY = opts.height / oldHeight;

  return host.undo.run(
    {
      textures: [texture],
      bitmap: true,
      elements: [...Cube.all],
      uv_only: true,
      uv_mode: true,
    },
    "resize_texture",
    () => {
      texture.edit((ctx, canvas) => {
        const previous = document.createElement("canvas");
        previous.width = canvas.width;
        previous.height = canvas.height;
        previous.getContext("2d")?.drawImage(canvas, 0, 0);
        canvas.width = opts.width;
        canvas.height = opts.height;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, opts.width, opts.height);
        ctx.drawImage(previous, 0, 0, opts.width, opts.height);
      }, "resize_texture");
      if (opts.rescale_uvs !== false) {
        for (const cube of Cube.all) {
          if (cube.uv_offset)
            cube.uv_offset = [
              cube.uv_offset[0] * scaleX,
              cube.uv_offset[1] * scaleY,
            ];
          for (const face of Object.values(cube.faces ?? {})) {
            if (!face.uv) continue;
            face.uv = [
              face.uv[0] * scaleX,
              face.uv[1] * scaleY,
              face.uv[2] * scaleX,
              face.uv[3] * scaleY,
            ];
          }
        }
      }
      if (Project) {
        Project.texture_width = opts.width;
        Project.texture_height = opts.height;
      }
      refreshView([...Cube.all]);
      return {
        ok: true as const,
        undo_label: "resize_texture",
        size: [opts.width, opts.height] as [number, number],
        uv_scale: [scaleX, scaleY] as [number, number],
      };
    },
  );
}
