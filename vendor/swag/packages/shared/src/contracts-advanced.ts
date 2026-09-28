import { z } from "zod";
import { vec3Schema } from "./protocol-base.js";

const faceTargetSchema = z
  .object({
    cube: z.string().min(1),
    face: z.enum(["north", "south", "east", "west", "up", "down"]),
  })
  .strict();

export const radialArrayCubesParamsSchema = z
  .object({
    sources: z.array(z.string().min(1)).min(1).max(32),
    count: z.number().int().min(2).max(128),
    axis: z.enum(["x", "y", "z"]).optional(),
    pivot: vec3Schema,
    angle: z.number().min(-360).max(360).optional(),
    rotate_cubes: z.boolean().optional(),
    name_pattern: z.string().min(1).optional(),
    uv_policy: z.enum(["share", "auto"]).optional(),
    parent: z.string().min(1).optional(),
  })
  .strict();

export const duplicateHierarchyParamsSchema = z
  .object({
    root: z.string().min(1),
    name_suffix: z.string().min(1).optional(),
    translate: vec3Schema.optional(),
    parent: z.string().min(1).optional(),
    uv_policy: z.enum(["share", "auto"]).optional(),
  })
  .strict();

export const transformUvIslandsParamsSchema = z
  .object({
    faces: z.array(faceTargetSchema).min(1).max(256),
    translate: z.tuple([z.number(), z.number()]).optional(),
    scale: z.tuple([z.number().positive(), z.number().positive()]).optional(),
    pivot: z.tuple([z.number(), z.number()]).optional(),
    rotate: z.enum(["0", "90", "180", "270"]).optional(),
    clamp_to_texture: z.boolean().optional(),
  })
  .strict()
  .refine((value) => value.translate || value.scale || value.rotate, {
    message: "Provide translate, scale, or rotate",
  });

export const auditMaterialSetParamsSchema = z
  .object({
    channels: z
      .object({
        base: z.string().min(1),
        emissive: z.string().min(1).optional(),
        normal: z.string().min(1).optional(),
        specular: z.string().min(1).optional(),
      })
      .strict(),
    require_power_of_two: z.boolean().optional(),
    naming_prefix: z.string().min(1).optional(),
  })
  .strict();

export const ensureMaterialSetParamsSchema = z
  .object({
    prefix: z.string().min(1),
    width: z.number().int().positive().max(1024),
    height: z.number().int().positive().max(1024),
    channels: z
      .array(z.enum(["base", "emissive", "normal", "specular"]))
      .min(1)
      .max(4),
    fills: z
      .object({
        base: z.string().min(1).optional(),
        emissive: z.string().min(1).optional(),
        normal: z.string().min(1).optional(),
        specular: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const inspectAnimationParamsSchema = z
  .object({ name: z.string().min(1) })
  .strict();

export const transformAnimationKeysParamsSchema = z
  .object({
    name: z.string().min(1),
    bones: z.array(z.string().min(1)).min(1).max(128).optional(),
    time_scale: z.number().positive().max(100).optional(),
    time_offset: z.number().min(-3600).max(3600).optional(),
    value_scale: vec3Schema.optional(),
    mirror_axis: z.enum(["x", "y", "z"]).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.time_scale !== undefined ||
      value.time_offset !== undefined ||
      value.value_scale !== undefined ||
      value.mirror_axis !== undefined,
    { message: "Provide at least one key transform" },
  );

export const analyzeViewSilhouetteParamsSchema = z
  .object({
    views: z
      .array(z.enum(["iso", "north", "south", "east", "west", "up", "down"]))
      .min(1)
      .max(7)
      .optional(),
    max_edge: z.number().int().min(64).max(512).optional(),
    alpha_threshold: z.number().int().min(0).max(255).optional(),
    luminance_threshold: z.number().int().min(0).max(255).optional(),
  })
  .strict();
