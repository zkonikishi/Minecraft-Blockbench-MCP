import { z } from "zod";

export const UV_MODES = ["box", "face"] as const;
export type UvMode = (typeof UV_MODES)[number];

export const uvModeSchema = z.enum(UV_MODES);

/**
 * Resolve box vs per-face UV without Blockbench globals.
 * Priority: explicit → unanimous cubes → Project → Format.box_uv → format id → face.
 */
export function resolveUvModeFromHints(h: {
  explicit?: UvMode | "auto" | null;
  projectBoxUv?: boolean | null;
  formatBoxUv?: boolean | null;
  formatId?: string | null;
  /** Per-cube box_uv flags when packing existing geometry. */
  cubeBoxFlags?: boolean[];
}): UvMode {
  if (h.explicit === "box" || h.explicit === "face") return h.explicit;

  const flags = h.cubeBoxFlags ?? [];
  if (flags.length > 0) {
    const boxN = flags.filter(Boolean).length;
    if (boxN === flags.length) return "box";
    if (boxN === 0) return "face";
  }

  if (typeof h.projectBoxUv === "boolean") {
    return h.projectBoxUv ? "box" : "face";
  }
  if (typeof h.formatBoxUv === "boolean") {
    return h.formatBoxUv ? "box" : "face";
  }

  const id = (h.formatId ?? "").toLowerCase();
  if (
    id === "java_block" ||
    id.includes("java_block") ||
    id === "optifine_entity" ||
    id.includes("optifine")
  ) {
    return "face";
  }
  if (
    id.includes("bedrock") ||
    id === "skin" ||
    id.includes("geckolib") ||
    id === "modded_entity"
  ) {
    return "box";
  }

  // Safe default for Minecraft Java-style block work in this repo.
  return "face";
}
