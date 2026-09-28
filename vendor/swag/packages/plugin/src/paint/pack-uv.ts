import { requireCube, requireProject, refreshView } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { CommandError } from "../errors.js";
import { applyPackedUvs, resolveUvMode, type UvMode } from "./uv-mode.js";
import { collectUvIslands } from "./uv-layout.js";

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

/**
 * Pack UV islands so cubes/faces do not share pixels.
 * Auto-detects box vs per-face from Project/Format/cubes (java_block → face).
 */
export function packBoxUv(opts: {
  cubes?: string[];
  texture?: string;
  padding?: number;
  auto_resize?: boolean;
  mode?: UvMode | "auto";
  preserve_others?: boolean;
  power_of_two?: boolean;
  max_size?: number;
}): {
  ok: true;
  undo_label: string;
  mode: UvMode;
  packed: number;
  used: [number, number];
  texture_size: [number, number];
} {
  requireProject();
  const list =
    opts.cubes && opts.cubes.length > 0
      ? opts.cubes.map((n) => requireCube(n))
      : [...Cube.all];
  if (list.length === 0) {
    throw new CommandError("E_NOT_FOUND", "No cubes to pack UV.");
  }

  const mode = resolveUvMode({
    explicit: opts.mode ?? "auto",
    cubes: list,
  });
  const pad = opts.padding ?? 1;
  let texW = Project?.texture_width ?? 64;
  let texH = Project?.texture_height ?? 64;
  const host = getHost();
  const texture = opts.texture
    ? host.textures.find(opts.texture)
    : host.textures.defaultOrFirst();
  if (opts.texture && !texture) {
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  }
  const selected = new Set(list.map((cube) => cube.uuid));
  const fixed =
    opts.preserve_others === false
      ? []
      : collectUvIslands().filter((island) => !selected.has(island.cube_uuid));
  const startY = fixed.length
    ? Math.ceil(Math.max(...fixed.map((island) => island.bounds[3])) + pad)
    : 0;

  return host.undo.run(
    {
      elements: list,
      textures: texture ? [texture] : [],
      bitmap: Boolean(texture),
      uv_only: true,
      uv_mode: true,
    },
    "pack_box_uv",
    (track) => {
      if (texture) track.addTextures([texture]);
      const { used, packed } = applyPackedUvs(list, {
        mode,
        texW,
        padding: pad,
        startY,
      });

      if (opts.auto_resize === false && (used[0] > texW || used[1] > texH)) {
        throw new CommandError(
          "E_INVALID_PARAM",
          `Packed UV extent ${used[0]}×${used[1]} exceeds atlas ${texW}×${texH}; enable auto_resize or use fewer/smaller islands`,
        );
      }

      if (opts.auto_resize !== false) {
        let needW = Math.max(texW, used[0]);
        let needH = Math.max(texH, used[1]);
        if (opts.power_of_two !== false) {
          needW = nextPowerOfTwo(needW);
          needH = nextPowerOfTwo(needH);
        }
        const maxSize = opts.max_size ?? 1024;
        if (needW > maxSize || needH > maxSize) {
          throw new CommandError(
            "E_INVALID_PARAM",
            `Packed atlas needs ${needW}×${needH}, exceeding max_size ${maxSize}`,
          );
        }
        if (needW !== texW || needH !== texH) {
          texW = needW;
          texH = needH;
          if (Project) {
            Project.texture_width = texW;
            Project.texture_height = texH;
          }
          texture?.edit((ctx, canvas) => {
            if (canvas.width >= texW && canvas.height >= texH) return;
            const prev = document.createElement("canvas");
            prev.width = canvas.width;
            prev.height = canvas.height;
            prev.getContext("2d")?.drawImage(canvas, 0, 0);
            canvas.width = Math.max(canvas.width, texW);
            canvas.height = Math.max(canvas.height, texH);
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(prev, 0, 0);
          }, "pack_box_uv resize");
        }
      }

      for (const c of list) texture?.applyToCube(c.uuid, true);

      refreshView(list.map((c) => ({ uuid: c.uuid, name: c.name })));
      return {
        ok: true as const,
        undo_label: "pack_box_uv",
        mode,
        packed,
        used,
        texture_size: [texW, texH],
      };
    },
  );
}
