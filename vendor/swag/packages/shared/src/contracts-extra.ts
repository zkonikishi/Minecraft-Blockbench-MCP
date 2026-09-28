import { z } from "zod";
import { vec3Schema } from "./protocol-base.js";

export const ensureTextureParamsSchema = z
  .object({
    name: z.string().min(1).optional(),
    width: z.number().int().positive().max(1024).optional(),
    height: z.number().int().positive().max(1024).optional(),
    fill: z.string().optional(),
  })
  .strict();

export const autoUvCubesParamsSchema = z
  .object({
    cubes: z.array(z.string().min(1)).optional(),
    /** Default `auto` = detect from Project/Format (java_block → face). */
    mode: z.enum(["box", "face", "auto"]).optional(),
  })
  .strict();

export const mirrorElementsParamsSchema = z
  .object({
    names: z.array(z.string().min(1)).min(1),
    axis: z.enum(["x", "y", "z"]).optional(),
    pivot: z.number().optional(),
    /** Rename: left↔right, _l↔_r, .L↔.R */
    rename: z.boolean().optional(),
  })
  .strict();

/** High-quality biped starter rig (Steve-like proportions). */
export const scaffoldBipedParamsSchema = z
  .object({
    /** Overall scale; 1 = classic 32px-tall player proportions in BB units. */
    scale: z.number().positive().max(4).optional(),
    texture_size: z.number().int().positive().max(256).optional(),
    name_prefix: z.string().optional(),
    include_outer_layers: z.boolean().optional(),
  })
  .strict();

const animationKeySchema = z
  .object({
    time: z.number().nonnegative(),
    value: vec3Schema,
    interpolation: z.enum(["linear", "catmullrom", "step"]).optional(),
  })
  .strict();

export const upsertAnimationParamsSchema = z
  .object({
    name: z.string().min(1),
    length: z.number().positive(),
    loop: z.enum(["once", "hold", "loop"]).optional(),
    bones: z
      .record(
        z
          .object({
            rotation: z.array(animationKeySchema).optional(),
            position: z.array(animationKeySchema).optional(),
            scale: z.array(animationKeySchema).optional(),
          })
          .strict(),
      )
      .optional(),
    replace: z.boolean().optional(),
  })
  .strict();
