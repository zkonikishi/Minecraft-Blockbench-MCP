import { getHost } from "../host/live.js";
import { requireProject } from "../bb/elements.js";

export function ensureTexture(opts: {
  name?: string;
  width?: number;
  height?: number;
  fill?: string;
}): { uuid: string; name: string; width: number; height: number } {
  requireProject();
  const host = getHost();
  const width = opts.width ?? 64;
  const height = opts.height ?? 64;
  const name = opts.name ?? "texture";
  const fill = opts.fill ?? "#808080";
  const existing = host.textures.find(name);
  if (existing) {
    return {
      uuid: existing.uuid,
      name: existing.name,
      width: existing.width,
      height: existing.height,
    };
  }
  return host.undo.run({ textures: [], bitmap: true }, `ensure_texture ${name}`, (track) => {
    const tex = host.textures.ensure({ name, width, height, fill });
    track.addTextures([tex]);
    host.canvas.updateAll();
    return {
      uuid: tex.uuid,
      name: tex.name,
      width: tex.width,
      height: tex.height,
    };
  });
}
