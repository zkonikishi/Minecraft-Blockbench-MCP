import { requireCube, requireProject, refreshView } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";
import { bbAnimation } from "../bb/globals.js";

export function setProjectMeta(opts: {
  name?: string;
  geometry_name?: string;
  texture_width?: number;
  texture_height?: number;
}): { ok: true; undo_label: string; updated: string[] } {
  requireProject();
  const project = Project as NonNullable<typeof Project> & {
    geometry_name?: string;
  };
  return getHost().undo.run({ uv_mode: true }, "set_project_meta", () => {
    const updated: string[] = [];
    if (opts.name !== undefined) {
      project.name = opts.name;
      updated.push("name");
    }
    if (opts.geometry_name !== undefined) {
      project.geometry_name = opts.geometry_name;
      updated.push("geometry_name");
    }
    if (opts.texture_width !== undefined) {
      project.texture_width = opts.texture_width;
      updated.push("texture_width");
    }
    if (opts.texture_height !== undefined) {
      project.texture_height = opts.texture_height;
      updated.push("texture_height");
    }
    getHost().canvas.updateAll();
    return { ok: true as const, undo_label: "set_project_meta", updated };
  });
}

export function assignTexture(opts: {
  texture: string;
  cubes: string[];
  faces?: string[];
}): { ok: true; undo_label: string; updated: string[] } {
  requireProject();
  const host = getHost();
  const texture = host.textures.find(opts.texture);
  if (!texture)
    throw new CommandError("E_NOT_FOUND", `Texture not found: ${opts.texture}`);
  const cubes = opts.cubes.map(requireCube);
  return host.undo.run(
    { elements: cubes, uv_only: true },
    "assign_texture",
    () => {
      for (const cube of cubes)
        texture.applyToCube(cube.uuid, opts.faces ?? true);
      refreshView(cubes);
      return {
        ok: true as const,
        undo_label: "assign_texture",
        updated: cubes.map((cube) => cube.uuid),
      };
    },
  );
}

export function deleteAnimation(opts: { name: string }): {
  ok: true;
  undo_label: string;
  deleted: string[];
} {
  requireProject();
  const api = bbAnimation();
  const animation = api?.all.find((item) => item.name === opts.name);
  if (!api || !animation)
    throw new CommandError("E_NOT_FOUND", `Animation not found: ${opts.name}`);
  return getHost().undo.run(
    { animations: [animation] },
    `delete_animation ${opts.name}`,
    () => {
      const removable = animation as unknown as {
        remove?: (undo?: boolean) => void;
      };
      if (typeof removable.remove === "function") removable.remove(false);
      else api.all.splice(api.all.indexOf(animation), 1);
      return {
        ok: true as const,
        undo_label: `delete_animation ${opts.name}`,
        deleted: [opts.name],
      };
    },
  );
}
