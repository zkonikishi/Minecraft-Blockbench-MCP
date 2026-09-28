import { z } from "zod";

const faceEnum = z.enum(["north", "south", "east", "west", "up", "down"]);

export const packBoxUvParamsSchema = z
  .object({
    cubes: z.array(z.string().min(1)).optional(),
    texture: z.string().optional(),
    padding: z.number().int().nonnegative().max(8).optional(),
    /** Grow Project.texture_* and bitmap if packed extent overflows. */
    auto_resize: z.boolean().optional(),
    /**
     * UV strategy. Default `auto` reads Project/Format/cubes
     * (`java_block` → per-face, Bedrock-style → box).
     */
    mode: z.enum(["box", "face", "auto"]).optional(),
    /** When packing a cube subset, keep clear of islands belonging to other cubes. */
    preserve_others: z.boolean().optional(),
    /** Round an automatically grown atlas up to powers of two (default true). */
    power_of_two: z.boolean().optional(),
    max_size: z.number().int().positive().max(4096).optional(),
  })
  .strict();

export const getUvLayoutParamsSchema = z
  .object({
    cubes: z.array(z.string().min(1)).max(256).optional(),
    /** Include pairwise overlap records (default true). */
    include_overlaps: z.boolean().optional(),
    /** Explicit face pairs whose shared texels are intentional. */
    allowed_overlaps: z
      .array(
        z
          .object({
            a: faceEnum,
            b: faceEnum,
            cube_a: z.string().min(1),
            cube_b: z.string().min(1),
          })
          .strict(),
      )
      .max(256)
      .optional(),
  })
  .strict();

export const getUvMapParamsSchema = z
  .object({
    texture: z.string().optional(),
    cubes: z.array(z.string().min(1)).max(256).optional(),
    max_edge: z.number().int().positive().max(1024).optional(),
    labels: z.boolean().optional(),
  })
  .strict();

export const resizeTextureParamsSchema = z
  .object({
    texture: z.string().optional(),
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
    /** Scale every cube UV with the bitmap (default true). */
    rescale_uvs: z.boolean().optional(),
  })
  .strict();

export const shadeModelBaseParamsSchema = z
  .object({
    cubes: z.array(z.string().min(1)).optional(),
    texture: z.string().optional(),
    base: z.string().min(1).optional(),
    /** First regex match wins: [{ match: "head", color: "#C68642" }, ...] */
    regions: z
      .array(
        z
          .object({
            match: z.string().min(1),
            color: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    top_light: z.number().min(0).max(1).optional(),
    bottom_dark: z.number().min(0).max(1).optional(),
    noise: z.number().min(0).max(1).optional(),
    blur: z.number().min(0).max(1).optional(),
    edge_darken: z.number().min(0).max(1).optional(),
    /** Reproducible pseudo-random mottle seed. */
    seed: z.number().int().optional(),
    /** Crisp disables gradients and blur for strict pixel art. */
    crisp: z.boolean().optional(),
  })
  .strict();

const paintOpSchema = z
  .object({
    type: z.enum(["fill", "rect", "ellipse", "line"]),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    x2: z.number().optional(),
    y2: z.number().optional(),
    color: z.string().min(1),
  })
  .strict();

const pixelPointSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
  })
  .strict();

const pixelStrokeSchema = z
  .object({
    cube: z.string().min(1),
    face: faceEnum,
    color: z.string().min(1),
    /** Face-local pixel path. Consecutive points are joined deterministically. */
    points: z.array(pixelPointSchema).min(1).max(4096),
    size: z.number().int().positive().max(32).optional(),
    shape: z.enum(["square", "circle"]).optional(),
  })
  .strict();

export const paintPixelBatchParamsSchema = z
  .object({
    texture: z.string().optional(),
    strokes: z.array(pixelStrokeSchema).min(1).max(256),
    /** Keep every brush stamp inside its target face (default true). */
    clip_to_face: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const points = value.strokes.reduce(
      (sum, stroke) => sum + stroke.points.length,
      0,
    );
    if (points > 16384) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["strokes"],
        message: "A batch may contain at most 16384 brush points",
      });
    }
  });

export const paintFaceFeaturesParamsSchema = z
  .object({
    texture: z.string().optional(),
    faces: z
      .array(
        z
          .object({
            cube: z.string().min(1),
            face: faceEnum,
            ops: z.array(paintOpSchema).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const getTextureParamsSchema = z
  .object({
    texture: z.string().optional(),
    /** Longest edge cap for returned image (default 256). */
    max_edge: z.number().int().positive().max(1024).optional(),
  })
  .strict();

const faceTargetSchema = z
  .object({
    cube: z.string().min(1),
    face: faceEnum,
  })
  .strict();

export const paintFaceGridParamsSchema = z
  .object({
    texture: z.string().optional(),
    expected_revision: z.string().min(1).optional(),
    faces: z
      .array(
        faceTargetSchema.extend({
          /** One Unicode code point per face-local texel. */
          rows: z.array(z.string()).min(1).max(4096),
        }),
      )
      .min(1)
      .max(256),
    /** Symbol to CSS color; null means exact transparent erase. */
    palette: z.record(z.string(), z.string().min(1).nullable()),
  })
  .strict();

export const getFaceGridParamsSchema = faceTargetSchema
  .extend({ texture: z.string().optional() })
  .strict();

export const editTexturePixelsParamsSchema = z
  .object({
    texture: z.string().optional(),
    expected_revision: z.string().min(1).optional(),
    face: faceTargetSchema.optional(),
    pixels: z
      .array(
        z
          .object({
            x: z.number().int().nonnegative(),
            y: z.number().int().nonnegative(),
            color: z.string().min(1).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(16384),
  })
  .strict();

export const replaceTextureColorParamsSchema = z
  .object({
    texture: z.string().optional(),
    expected_revision: z.string().min(1).optional(),
    face: faceTargetSchema.optional(),
    from: z.string().min(1),
    to: z.string().min(1).nullable(),
    tolerance: z.number().int().min(0).max(255).optional(),
  })
  .strict();

export const copyFacePixelsParamsSchema = z
  .object({
    texture: z.string().optional(),
    expected_revision: z.string().min(1).optional(),
    source: faceTargetSchema,
    target: faceTargetSchema,
    flip_x: z.boolean().optional(),
    flip_y: z.boolean().optional(),
    rotation: z.enum(["0", "90", "180", "270"]).optional(),
  })
  .strict();

export const analyzeTexturePaletteParamsSchema = z
  .object({
    texture: z.string().optional(),
    face: faceTargetSchema.optional(),
    max_colors: z.number().int().positive().max(256).optional(),
  })
  .strict();

export const getTextureRegionParamsSchema = z
  .object({
    texture: z.string().optional(),
    face: faceTargetSchema.optional(),
    rect: z
      .tuple([
        z.number().int().nonnegative(),
        z.number().int().nonnegative(),
        z.number().int().positive(),
        z.number().int().positive(),
      ])
      .optional(),
    scale: z.number().int().positive().max(64).optional(),
    grid: z.boolean().optional(),
    checkerboard: z.boolean().optional(),
  })
  .strict()
  .refine((value) => !(value.face && value.rect), {
    message: "Choose face or rect, not both",
  });

export const importTexturePngParamsSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .regex(/\.png$/i, "path must end in .png"),
    texture: z.string().optional(),
    name: z.string().min(1).optional(),
    resize_project: z.boolean().optional(),
    expected_revision: z.string().min(1).optional(),
  })
  .strict();

export const getTextureRevisionParamsSchema = z
  .object({ texture: z.string().optional() })
  .strict();

export const floodFillTextureParamsSchema = z
  .object({
    texture: z.string().optional(),
    expected_revision: z.string().min(1).optional(),
    face: faceTargetSchema.optional(),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    color: z.string().min(1).nullable(),
    tolerance: z.number().int().min(0).max(255).optional(),
    diagonal: z.boolean().optional(),
    max_pixels: z.number().int().positive().max(65536).optional(),
  })
  .strict();

export const transformTextureRegionParamsSchema = z
  .object({
    texture: z.string().optional(),
    expected_revision: z.string().min(1).optional(),
    face: faceTargetSchema.optional(),
    rect: z
      .tuple([
        z.number().int().nonnegative(),
        z.number().int().nonnegative(),
        z.number().int().positive(),
        z.number().int().positive(),
      ])
      .optional(),
    operation: z.enum([
      "flip_x",
      "flip_y",
      "rotate_180",
      "rotate_90",
      "rotate_270",
    ]),
  })
  .strict()
  .refine((value) => Boolean(value.face) !== Boolean(value.rect), {
    message: "Choose exactly one of face or rect",
  });

export const auditTextureQualityParamsSchema = z
  .object({
    texture: z.string().optional(),
    faces: z.array(faceTargetSchema).max(256).optional(),
    palette_limit: z.number().int().positive().max(256).optional(),
    min_base_ratio: z.number().min(0).max(1).optional(),
    glass: z.boolean().optional(),
  })
  .strict();

export const exportTexturePngParamsSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .regex(/\.png$/i, "path must end in .png"),
    texture: z.string().optional(),
    overwrite: z.boolean().optional(),
  })
  .strict();
