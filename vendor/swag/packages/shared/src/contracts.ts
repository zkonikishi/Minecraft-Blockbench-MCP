import { z } from "zod";
import {
  DEFAULTS,
  PROJECT_FORMATS,
  VIEW_PRESETS,
  errorPayloadSchema,
  vec3Schema,
} from "./protocol-base.js";
import { capabilitiesSchema } from "./capabilities.js";

/** Compact observation — prefer over screenshots. */
export const projectSummarySchema = z
  .object({
    format: z.string(),
    name: z.string().optional(),
    geometry_name: z.string().optional(),
    texture_width: z.number().int().positive().optional(),
    texture_height: z.number().int().positive().optional(),
    /** Resolved UV strategy for this project (box vs per-face). */
    uv_mode: z.enum(["box", "face"]).optional(),
    capabilities: capabilitiesSchema.optional(),
    cubes: z.number().int().nonnegative(),
    groups: z.number().int().nonnegative(),
    textures: z.number().int().nonnegative(),
    animations: z.number().int().nonnegative(),
    outliner: z.array(
      z
        .object({
          uuid: z.string(),
          name: z.string(),
          type: z.enum(["group", "cube"]),
          parent: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const checkFindingSchema = z
  .object({
    severity: z.enum(["error", "warn", "info"]),
    code: z.string(),
    element: z.string().optional(),
    message: z.string(),
  })
  .strict();

export const checkModelResultSchema = z
  .object({
    findings: z.array(checkFindingSchema),
    summary: z
      .object({
        cubes: z.number().int().nonnegative(),
        groups: z.number().int().nonnegative(),
        errors: z.number().int().nonnegative(),
        warns: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type CheckModelResult = z.infer<typeof checkModelResultSchema>;

const checkFaceTargetSchema = z
  .object({
    cube: z.string().min(1),
    face: z.enum(["north", "south", "east", "west", "up", "down"]),
  })
  .strict();

export const checkModelParamsSchema = z
  .object({
    allowed_uv_overlaps: z
      .array(
        z
          .object({ a: checkFaceTargetSchema, b: checkFaceTargetSchema })
          .strict(),
      )
      .max(256)
      .optional(),
  })
  .strict();

export const captureViewsParamsSchema = z
  .object({
    views: z.array(z.enum(VIEW_PRESETS)).min(1).optional(),
    max_edge: z
      .number()
      .int()
      .positive()
      .max(DEFAULTS.screenshotMaxEdgeCap)
      .optional(),
    format: z.enum(["jpeg", "png"]).optional(),
    quality: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export type CaptureViewsParams = z.infer<typeof captureViewsParamsSchema>;

export const captureViewsDefaults = {
  views: ["iso", "north", "east"] as const,
  max_edge: DEFAULTS.screenshotMaxEdge,
  format: DEFAULTS.screenshotFormat,
  quality: DEFAULTS.screenshotQuality,
} as const;

export const captureViewMetaSchema = z
  .object({
    view: z.enum(VIEW_PRESETS),
    visible_face: z.enum(VIEW_PRESETS).nullable(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    bytes: z.number().int().nonnegative(),
    mime: z.string(),
  })
  .strict();

export const mutationSuccessSchema = z
  .object({
    ok: z.literal(true),
    undo_label: z.string(),
    created: z
      .array(
        z
          .object({
            uuid: z.string(),
            name: z.string(),
            type: z.string(),
          })
          .strict(),
      )
      .optional(),
    updated: z.array(z.string()).optional(),
    deleted: z.array(z.string()).optional(),
  })
  .strict();

export const mutationFailureSchema = z
  .object({
    ok: z.literal(false),
    code: errorPayloadSchema.shape.code,
    message: z.string(),
    details: z.unknown().optional(),
  })
  .strict();

export const mutationResultSchema = z.union([
  mutationSuccessSchema,
  mutationFailureSchema,
]);

export type MutationResult = z.infer<typeof mutationResultSchema>;

export const createProjectParamsSchema = z
  .object({
    format: z.enum(PROJECT_FORMATS),
    uv_mode: z.enum(["box", "face"]).optional(),
    geometry_name: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    texture_width: z.number().int().positive().optional(),
    texture_height: z.number().int().positive().optional(),
  })
  .strict();

export const cubeSpecSchema = z
  .object({
    name: z.string().min(1),
    from: vec3Schema,
    to: vec3Schema,
    origin: vec3Schema.optional(),
    rotation: vec3Schema.optional(),
    inflate: z.number().optional(),
    parent: z.string().optional(),
  })
  .strict();

export const groupSpecSchema = z
  .object({
    name: z.string().min(1),
    origin: vec3Schema.optional(),
    rotation: vec3Schema.optional(),
    parent: z.string().optional(),
  })
  .strict();

/** All-or-nothing geometry transaction. */
export const applyGeometryBatchParamsSchema = z
  .object({
    create_groups: z.array(groupSpecSchema).optional(),
    create_cubes: z.array(cubeSpecSchema).optional(),
    delete_uuids: z.array(z.string().min(1)).optional(),
    undo_label: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (v) =>
      (v.create_groups?.length ?? 0) +
        (v.create_cubes?.length ?? 0) +
        (v.delete_uuids?.length ?? 0) >
      0,
    { message: "Batch must create or delete at least one element" },
  );

export const createLimbParamsSchema = z
  .object({
    name: z.string().min(1),
    parent: z.string().optional(),
    pivot: vec3Schema,
    size: vec3Schema,
    /** Lower corner of the cube in model space; default centers on pivot. */
    from: vec3Schema.optional(),
    mirror: z.enum(["none", "x"]).optional(),
    undo_label: z.string().optional(),
  })
  .strict();

export const paintFaceFeatureParamsSchema = z
  .object({
    cube: z.string().min(1),
    face: z.enum(["north", "south", "east", "west", "up", "down"]),
    feature: z.enum(["rect", "ellipse", "fill"]),
    /** Face-local UV coords: origin top-left of that face's UV rect. */
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    color: z.string().min(1),
    texture: z.string().optional(),
  })
  .strict();

export const healthResultSchema = z
  .object({
    protocol_version: z.number().int(),
    plugin_version: z.string(),
    blockbench_version: z.string(),
    format: z.string().nullable(),
    uv_mode: z.enum(["box", "face"]).optional(),
    capabilities: capabilitiesSchema.optional(),
    mode: z.literal("in-process"),
  })
  .strict();

export type HealthResult = z.infer<typeof healthResultSchema>;
