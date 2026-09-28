import { requireProject } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { CommandError } from "../errors.js";

/** Return a compact PNG data URL of a project texture for agent inspection. */
export function getTexture(opts: { texture?: string; max_edge?: number }): {
  name: string;
  uuid: string;
  width: number;
  height: number;
  max_edge: number;
  mime: string;
  data_url: string;
} {
  requireProject();
  const host = getHost();
  const tex = opts.texture
    ? host.textures.find(opts.texture)
    : host.textures.defaultOrFirst();
  if (opts.texture && !tex) {
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  }
  if (!tex) throw new CommandError("E_NOT_FOUND", "No texture in project");

  const maxEdge = opts.max_edge ?? 256;
  const dataUrl = tex.toDataURL(maxEdge);
  return {
    name: tex.name,
    uuid: tex.uuid,
    width: tex.width,
    height: tex.height,
    max_edge: maxEdge,
    mime: "image/png",
    data_url: dataUrl,
  };
}
