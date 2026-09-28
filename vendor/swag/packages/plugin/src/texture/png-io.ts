import type { SessionState } from "../session.js";
import { requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";
import {
  readScopedBinary,
  writeScopedBinary,
} from "../commands/scope-export.js";
import { requireTextureHandle } from "../paint/texture-pixels.js";
import {
  assertTextureRevision,
  textureRevision,
} from "../paint/texture-revision.js";

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function decodeDataUrl(url: string): Uint8Array {
  const encoded = url.split(",", 2)[1];
  if (!encoded)
    throw new CommandError("E_BLOCKBENCH_ERROR", "Invalid texture data URL");
  const binary = atob(encoded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function decodePng(bytes: Uint8Array): Promise<HTMLImageElement> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new CommandError("E_INVALID_PARAM", "PNG decode failed"));
    image.src = `data:image/png;base64,${base64(bytes)}`;
  });
  return image;
}

export async function importTexturePng(
  session: SessionState,
  opts: {
    path: string;
    texture?: string;
    name?: string;
    resize_project?: boolean;
    expected_revision?: string;
  },
): Promise<{
  ok: true;
  undo_label: string;
  name: string;
  uuid: string;
  size: [number, number];
  bytes: number;
  revision: string;
}> {
  requireProject();
  const bytes = readScopedBinary(session, opts.path);
  const image = await decodePng(bytes);
  const host = getHost();
  const existing = opts.texture ? host.textures.find(opts.texture) : undefined;
  if (opts.texture && !existing)
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  if (existing) await assertTextureRevision(existing, opts.expected_revision);
  const oldWidth = Project?.texture_width;
  const oldHeight = Project?.texture_height;
  const result = host.undo.run(
    { textures: existing ? [existing] : [], bitmap: true, uv_mode: true },
    "import_texture_png",
    (track) => {
      const target =
        existing ??
        host.textures.ensure({
          name: opts.name ?? "imported_texture",
          width: image.width,
          height: image.height,
          fill: "rgba(0,0,0,0)",
        });
      track.addTextures([target]);
      target.edit((ctx, canvas) => {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
      }, "import_texture_png");
      if (opts.resize_project !== false && Project) {
        Project.texture_width = image.width;
        Project.texture_height = image.height;
      } else if (Project) {
        if (oldWidth !== undefined) Project.texture_width = oldWidth;
        if (oldHeight !== undefined) Project.texture_height = oldHeight;
      }
      host.canvas.updateAll();
      return {
        ok: true as const,
        undo_label: "import_texture_png",
        name: target.name,
        uuid: target.uuid,
        size: [image.width, image.height] as [number, number],
        bytes: bytes.byteLength,
      };
    },
  );
  const imported = host.textures.find(result.uuid);
  if (!imported)
    throw new CommandError(
      "E_BLOCKBENCH_ERROR",
      "Imported texture disappeared",
    );
  return { ...result, revision: await textureRevision(imported) };
}

export function exportTexturePng(
  session: SessionState,
  opts: {
    path: string;
    texture?: string;
    overwrite?: boolean;
  },
): {
  ok: true;
  path: string;
  bytes: number;
  name: string;
  size: [number, number];
} {
  requireProject();
  const texture = requireTextureHandle(opts.texture);
  const bytes = decodeDataUrl(
    texture.toDataURL(Math.max(texture.width, texture.height)),
  );
  const result = writeScopedBinary(session, opts.path, bytes, opts.overwrite);
  return {
    ok: true,
    ...result,
    name: texture.name,
    size: [texture.width, texture.height],
  };
}
