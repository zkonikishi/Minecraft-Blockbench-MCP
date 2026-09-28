import { requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";

export function auditMaterialSet(opts: {
  channels: {
    base: string;
    emissive?: string;
    normal?: string;
    specular?: string;
  };
  require_power_of_two?: boolean;
  naming_prefix?: string;
}) {
  requireProject();
  const host = getHost();
  const entries = Object.entries(opts.channels).map(([channel, ref]) => {
    const texture = host.textures.find(ref);
    if (!texture)
      throw new CommandError("E_NOT_FOUND", `Texture not found: ${ref}`);
    return { channel, texture };
  });
  const base = entries.find((entry) => entry.channel === "base")!.texture;
  const findings: Array<{
    severity: "error" | "warn";
    code: string;
    message: string;
  }> = [];
  const powerOfTwo = (value: number) => (value & (value - 1)) === 0;
  for (const { channel, texture } of entries) {
    if (texture.width !== base.width || texture.height !== base.height) {
      findings.push({
        severity: "error",
        code: "MATERIAL_SIZE_MISMATCH",
        message: `${channel} ${texture.name} is ${texture.width}×${texture.height}; base is ${base.width}×${base.height}`,
      });
    }
    if (
      opts.require_power_of_two !== false &&
      (!powerOfTwo(texture.width) || !powerOfTwo(texture.height))
    ) {
      findings.push({
        severity: "warn",
        code: "MATERIAL_NOT_POWER_OF_TWO",
        message: `${channel} ${texture.name} is not power-of-two`,
      });
    }
    if (opts.naming_prefix && !texture.name.startsWith(opts.naming_prefix)) {
      findings.push({
        severity: "warn",
        code: "MATERIAL_NAME_MISMATCH",
        message: `${channel} ${texture.name} does not start with ${opts.naming_prefix}`,
      });
    }
  }
  return {
    channels: Object.fromEntries(
      entries.map(({ channel, texture }) => [
        channel,
        {
          uuid: texture.uuid,
          name: texture.name,
          width: texture.width,
          height: texture.height,
        },
      ]),
    ),
    findings,
    summary: {
      channels: entries.length,
      errors: findings.filter((finding) => finding.severity === "error").length,
      warns: findings.filter((finding) => finding.severity === "warn").length,
    },
  };
}

export function ensureMaterialSet(opts: {
  prefix: string;
  width: number;
  height: number;
  channels: Array<"base" | "emissive" | "normal" | "specular">;
  fills?: Partial<Record<"base" | "emissive" | "normal" | "specular", string>>;
}) {
  requireProject();
  const defaults = {
    base: "#808080ff",
    emissive: "#000000ff",
    normal: "#8080ffff",
    specular: "#000000ff",
  };
  const host = getHost();
  return host.undo.run(
    { textures: [], bitmap: true },
    "ensure_material_set",
    (track) => {
      const textures = [...new Set(opts.channels)].map((channel) => {
        const texture = host.textures.ensure({
          name: `${opts.prefix}_${channel}`,
          width: opts.width,
          height: opts.height,
          fill: opts.fills?.[channel] ?? defaults[channel],
        });
        track.addTextures([texture]);
        return {
          channel,
          uuid: texture.uuid,
          name: texture.name,
          width: texture.width,
          height: texture.height,
        };
      });
      return { ok: true as const, undo_label: "ensure_material_set", textures };
    },
  );
}
