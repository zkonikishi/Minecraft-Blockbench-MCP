import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";
import type { TextureHandle } from "../host/ports.js";

function resolveTexture(ref?: string): TextureHandle {
  const host = getHost();
  const texture = ref
    ? host.textures.find(ref)
    : host.textures.defaultOrFirst();
  if (!texture) {
    throw new CommandError(
      "E_NOT_FOUND",
      ref ? `Texture not found: ${ref}` : "No texture available",
    );
  }
  return texture;
}

async function revisionCanvas(
  texture: TextureHandle,
): Promise<HTMLCanvasElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new CommandError("E_BLOCKBENCH_ERROR", "Texture decode failed"));
    image.src = texture.toDataURL(Math.max(texture.width, texture.height));
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return canvas;
}

export function revisionFromPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string {
  let hash = 0x811c9dc5;
  const mix = (value: number) => {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  for (const value of data) mix(value);
  for (const value of [width & 255, width >>> 8, height & 255, height >>> 8])
    mix(value);
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

export async function textureRevision(texture: TextureHandle): Promise<string> {
  const canvas = await revisionCanvas(texture);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CommandError("E_BLOCKBENCH_ERROR", "No 2d context");
  return revisionFromPixels(
    ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    canvas.width,
    canvas.height,
  );
}

export async function assertTextureRevision(
  texture: TextureHandle,
  expected?: string,
): Promise<void> {
  if (!expected) return;
  const actual = await textureRevision(texture);
  if (actual !== expected) {
    throw new CommandError(
      "E_PARTIAL_FORBIDDEN",
      "Texture changed since it was read; refresh and retry",
      { expected, actual },
    );
  }
}

export async function getTextureRevision(opts: { texture?: string }): Promise<{
  texture: string;
  uuid: string;
  width: number;
  height: number;
  revision: string;
}> {
  const texture = resolveTexture(opts.texture);
  return {
    texture: texture.name,
    uuid: texture.uuid,
    width: texture.width,
    height: texture.height,
    revision: await textureRevision(texture),
  };
}
