import { z } from "zod";
import { vec3Schema } from "./protocol-base.js";

const faceEnum = z.enum(["north", "south", "east", "west", "up", "down"]);

export const getElementsParamsSchema = z
  .object({ refs: z.array(z.string().min(1)).max(256).optional() })
  .strict();

const elementUpdateSchema = z
  .object({
    ref: z.string().min(1),
    name: z.string().min(1).optional(),
    parent: z.string().min(1).optional(),
    from: vec3Schema.optional(),
    to: vec3Schema.optional(),
    origin: vec3Schema.optional(),
    rotation: vec3Schema.optional(),
    inflate: z.number().optional(),
    visibility: z.boolean().optional(),
  })
  .strict();

export const updateElementsParamsSchema = z
  .object({
    updates: z.array(elementUpdateSchema).min(1).max(256),
    undo_label: z.string().min(1).optional(),
    /** preserve keeps current UVs; auto remaps cubes whose dimensions changed. */
    uv_policy: z.enum(["preserve", "auto"]).optional(),
  })
  .strict();

export const transformElementsParamsSchema = z
  .object({
    refs: z.array(z.string().min(1)).min(1).max(256),
    translate: vec3Schema.optional(),
    scale: vec3Schema.optional(),
    pivot: vec3Schema.optional(),
    rotate: vec3Schema.optional(),
    uv_policy: z.enum(["preserve", "auto"]).optional(),
    undo_label: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => value.translate || value.scale || value.rotate, {
    message: "Provide translate, scale, or rotate",
  });

export const arrayCubesParamsSchema = z
  .object({
    sources: z.array(z.string().min(1)).min(1).max(64),
    count: z.number().int().min(1).max(128),
    offset: vec3Schema,
    name_pattern: z.string().min(1).optional(),
    uv_policy: z.enum(["share", "auto"]).optional(),
    parent: z.string().min(1).optional(),
  })
  .strict();

export const measureModelParamsSchema = z
  .object({ refs: z.array(z.string().min(1)).max(256).optional() })
  .strict();

export const auditSymmetryParamsSchema = z
  .object({
    pairs: z
      .array(
        z
          .object({ left: z.string().min(1), right: z.string().min(1) })
          .strict(),
      )
      .min(1)
      .max(128),
    axis: z.enum(["x", "y", "z"]).optional(),
    pivot: z.number().optional(),
    tolerance: z.number().nonnegative().max(16).optional(),
  })
  .strict();

export const setFaceUvParamsSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            cube: z.string().min(1),
            face: faceEnum,
            uv: z.tuple([z.number(), z.number(), z.number(), z.number()]),
            rotation: z
              .union([
                z.literal(0),
                z.literal(90),
                z.literal(180),
                z.literal(270),
              ])
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(1536),
  })
  .strict();

export const assignTextureParamsSchema = z
  .object({
    texture: z.string().min(1),
    cubes: z.array(z.string().min(1)).min(1).max(256),
    faces: z.array(faceEnum).min(1).optional(),
  })
  .strict();

export const setProjectMetaParamsSchema = z
  .object({
    name: z.string().min(1).optional(),
    geometry_name: z.string().min(1).optional(),
    texture_width: z.number().int().positive().max(4096).optional(),
    texture_height: z.number().int().positive().max(4096).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one project field is required",
  });

export const deleteAnimationParamsSchema = z
  .object({ name: z.string().min(1) })
  .strict();
