import type { Vec3 } from "@blockbench-mcp/shared";
import { refreshView, requireProject } from "../bb/elements.js";
import { getHost } from "../host/live.js";
import { runCheckModel } from "../check/rules.js";
import { applyPackedUvs, resolveUvMode } from "../paint/uv-mode.js";

/**
 * Classic Minecraft player proportions. Returns check_model so agents see issues immediately.
 * UV mode follows the open project (box for Bedrock-style, per-face for java_block).
 */
export function scaffoldBiped(opts: {
  scale?: number;
  texture_size?: number;
  name_prefix?: string;
  include_outer_layers?: boolean;
}): {
  ok: true;
  undo_label: string;
  mode: "box" | "face";
  created: { uuid: string; name: string; type: string }[];
  check: ReturnType<typeof runCheckModel>;
} {
  requireProject();
  const s = opts.scale ?? 1;
  const prefix = opts.name_prefix ?? "";
  const texSize = opts.texture_size ?? 64;
  const uvMode = resolveUvMode();
  const label = `scaffold_biped scale=${s} uv=${uvMode}`;
  const host = getHost();

  return host.undo.run({ outliner: true, elements: [], textures: [], bitmap: true }, label, (track) => {
    const skin = host.textures.ensure({
      name: `${prefix || ""}skin`,
      width: texSize,
      height: texSize,
      fill: "#8a8a8a",
    });
    track.addTextures([skin]);

    skin.edit((ctx, canvas) => {
      ctx.fillStyle = "#6e6e6e";
      ctx.fillRect(0, Math.floor(canvas.height / 2), canvas.width, Math.ceil(canvas.height / 2));
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(0, 0, canvas.width, Math.floor(canvas.height / 2));
    }, "scaffold base shade");

    const created: { uuid: string; name: string; type: string }[] = [];
    const push = (el: { uuid: string; name: string }, type: string) => {
      const row = { uuid: el.uuid, name: el.name, type };
      created.push(row);
      track.addElements([row]);
    };

    const mk = (
      name: string,
      parent: Group,
      from: Vec3,
      size: Vec3,
      origin: Vec3,
      inflate = 0,
    ) => cubeOn(name, parent, from, size, origin, skin.uuid, uvMode === "box", inflate);

    const root = bone(`${prefix}root`, [0, 0, 0], "root");
    push(root, "group");
    const body = bone(`${prefix}body`, [0, 24 * s, 0], root);
    push(body, "group");
    push(mk(`${prefix}body_cube`, body, [-4 * s, 12 * s, -2 * s], [8 * s, 12 * s, 4 * s], [0, 24 * s, 0]), "cube");

    const head = bone(`${prefix}head`, [0, 24 * s, 0], body);
    push(head, "group");
    push(mk(`${prefix}head_cube`, head, [-4 * s, 24 * s, -4 * s], [8 * s, 8 * s, 8 * s], [0, 24 * s, 0]), "cube");

    const armR = bone(`${prefix}arm_right`, [-6 * s, 22 * s, 0], body);
    const armL = bone(`${prefix}arm_left`, [6 * s, 22 * s, 0], body);
    push(armR, "group");
    push(armL, "group");
    push(mk(`${prefix}arm_right_cube`, armR, [-8 * s, 12 * s, -2 * s], [4 * s, 12 * s, 4 * s], [-6 * s, 22 * s, 0]), "cube");
    push(mk(`${prefix}arm_left_cube`, armL, [4 * s, 12 * s, -2 * s], [4 * s, 12 * s, 4 * s], [6 * s, 22 * s, 0]), "cube");

    const legR = bone(`${prefix}leg_right`, [-2 * s, 12 * s, 0], body);
    const legL = bone(`${prefix}leg_left`, [2 * s, 12 * s, 0], body);
    push(legR, "group");
    push(legL, "group");
    push(mk(`${prefix}leg_right_cube`, legR, [-4 * s, 0, -2 * s], [4 * s, 12 * s, 4 * s], [-2 * s, 12 * s, 0]), "cube");
    push(mk(`${prefix}leg_left_cube`, legL, [0, 0, -2 * s], [4 * s, 12 * s, 4 * s], [2 * s, 12 * s, 0]), "cube");

    if (opts.include_outer_layers) {
      push(
        mk(`${prefix}hat`, head, [-4.5 * s, 23.5 * s, -4.5 * s], [9 * s, 9 * s, 9 * s], [0, 24 * s, 0], 0.25 * s),
        "cube",
      );
    }

    const cubes = Cube.all.filter((c) => c.name.startsWith(prefix) || !prefix);
    applyPackedUvs(cubes, { mode: uvMode, texW: texSize, padding: 1 });
    for (const c of cubes) skin.applyToCube(c.uuid, true);

    refreshView(created);
    const check = runCheckModel();
    return { ok: true as const, undo_label: label, mode: uvMode, created, check };
  });
}

function bone(name: string, origin: Vec3, parent: Group | "root"): Group {
  const g = new Group({ name, origin: [...origin], rotation: [0, 0, 0] })
    .init()
    .addTo(parent);
  g.createUniqueName?.();
  return g;
}

function cubeOn(
  name: string,
  parent: Group,
  from: Vec3,
  size: Vec3,
  origin: Vec3,
  textureUuid: string,
  boxUv: boolean,
  inflate = 0,
): Cube {
  const to: Vec3 = [from[0] + size[0], from[1] + size[1], from[2] + size[2]];
  const c = new Cube({
    name,
    from: [...from],
    to,
    origin: [...origin],
    inflate,
    autouv: 1,
    box_uv: boxUv,
  })
    .init()
    .addTo(parent);
  c.mapAutoUV?.();
  getHost().textures.find(textureUuid)?.applyToCube(c.uuid, true);
  return c;
}
