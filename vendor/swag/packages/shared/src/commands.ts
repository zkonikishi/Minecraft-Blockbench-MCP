import { z } from "zod";
import {
  applyGeometryBatchParamsSchema,
  captureViewsParamsSchema,
  checkModelResultSchema,
  checkModelParamsSchema,
  createLimbParamsSchema,
  createProjectParamsSchema,
  paintFaceFeatureParamsSchema,
  projectSummarySchema,
} from "./contracts.js";
import {
  autoUvCubesParamsSchema,
  ensureTextureParamsSchema,
  mirrorElementsParamsSchema,
  scaffoldBipedParamsSchema,
  upsertAnimationParamsSchema,
} from "./contracts-extra.js";
import {
  getTextureParamsSchema,
  getUvLayoutParamsSchema,
  getUvMapParamsSchema,
  packBoxUvParamsSchema,
  paintFaceFeaturesParamsSchema,
  paintPixelBatchParamsSchema,
  resizeTextureParamsSchema,
  shadeModelBaseParamsSchema,
  paintFaceGridParamsSchema,
  getFaceGridParamsSchema,
  editTexturePixelsParamsSchema,
  replaceTextureColorParamsSchema,
  copyFacePixelsParamsSchema,
  analyzeTexturePaletteParamsSchema,
  getTextureRegionParamsSchema,
  importTexturePngParamsSchema,
  exportTexturePngParamsSchema,
  getTextureRevisionParamsSchema,
  floodFillTextureParamsSchema,
  transformTextureRegionParamsSchema,
  auditTextureQualityParamsSchema,
} from "./contracts-texture.js";
import {
  assignTextureParamsSchema,
  deleteAnimationParamsSchema,
  getElementsParamsSchema,
  setFaceUvParamsSchema,
  setProjectMetaParamsSchema,
  updateElementsParamsSchema,
  transformElementsParamsSchema,
  arrayCubesParamsSchema,
  measureModelParamsSchema,
  auditSymmetryParamsSchema,
} from "./contracts-management.js";
import {
  analyzeViewSilhouetteParamsSchema,
  auditMaterialSetParamsSchema,
  ensureMaterialSetParamsSchema,
  duplicateHierarchyParamsSchema,
  inspectAnimationParamsSchema,
  radialArrayCubesParamsSchema,
  transformAnimationKeysParamsSchema,
  transformUvIslandsParamsSchema,
} from "./contracts-advanced.js";

export interface CommandSpec<P extends z.ZodType = z.ZodType> {
  description: string;
  mutates: boolean;
  params: P;
  result?: z.ZodType;
}

export const COMMAND_SPECS = {
  list_formats: {
    description:
      "List model formats currently registered in Blockbench, including plugin formats.",
    mutates: false,
    params: checkModelParamsSchema,
  },
  get_project_summary: {
    description:
      "Compact outliner + counts. Prefer over screenshots for situational awareness.",
    mutates: false,
    params: z.object({}).strict(),
    result: projectSummarySchema,
  },
  get_elements: {
    description:
      "Read exact cube/group geometry, hierarchy, visibility, UV rectangles, rotations, and texture references.",
    mutates: false,
    params: getElementsParamsSchema,
  },
  measure_model: {
    description:
      "Measure model or subtree bounds, size, center, cube count, and summed volume.",
    mutates: false,
    params: measureModelParamsSchema,
  },
  audit_symmetry: {
    description:
      "Compare explicit left/right cube or group pairs across an axis and report coordinate error.",
    mutates: false,
    params: auditSymmetryParamsSchema,
  },
  analyze_view_silhouette: {
    description:
      "Capture views and return deterministic silhouette bounds, coverage, and preview images for visual QA.",
    mutates: false,
    params: analyzeViewSilhouetteParamsSchema,
  },
  list_textures: {
    description:
      "List project textures with UUID, name, and bitmap dimensions.",
    mutates: false,
    params: z.object({}).strict(),
  },
  list_animations: {
    description: "List project animations with name, length, and loop mode.",
    mutates: false,
    params: z.object({}).strict(),
  },
  check_model: {
    description:
      "Audit overlaps, empty groups, zero-size cubes, bad pivots, untextured faces. Call after geometry batches.",
    mutates: false,
    params: z.object({}).strict(),
    result: checkModelResultSchema,
  },
  capture_views: {
    description:
      "Low-res multi-angle screenshots. Default max_edge 256 jpeg. Use sparingly after check_model.",
    mutates: false,
    params: captureViewsParamsSchema,
  },
  get_guide: {
    description:
      "Playbook before building. Topics: modeling|texturing|animation|java_block|geckolib. ALWAYS call modeling first for entities.",
    mutates: false,
    params: z
      .object({
        topic: z
          .enum([
            "modeling",
            "texturing",
            "animation",
            "java_block",
            "geckolib",
          ])
          .optional(),
      })
      .strict(),
  },
  create_project: {
    description:
      "Create java_block, bedrock, bedrock_old, or geckolib_model project (closes nothing silently — requires format).",
    mutates: true,
    params: createProjectParamsSchema,
  },
  set_project_meta: {
    description:
      "Update project name, geometry identifier, or texture resolution in one undo.",
    mutates: true,
    params: setProjectMetaParamsSchema,
  },
  apply_geometry_batch: {
    description:
      "Create/delete groups+cubes in ONE undo. All-or-nothing. Prefer for multi-part shapes.",
    mutates: true,
    params: applyGeometryBatchParamsSchema,
  },
  update_elements: {
    description:
      "Batch rename, transform, resize, reparent, or show/hide existing cubes and groups in ONE undo.",
    mutates: true,
    params: updateElementsParamsSchema,
  },
  transform_elements: {
    description:
      "Translate, scale, and rotate multiple cubes/groups around one pivot in a single undo.",
    mutates: true,
    params: transformElementsParamsSchema,
  },
  array_cubes: {
    description:
      "Create a bounded linear array of cubes with shared or auto-remapped UVs in one undo.",
    mutates: true,
    params: arrayCubesParamsSchema,
  },
  radial_array_cubes: {
    description:
      "Create a bounded radial array of cubes around a pivot with shared or regenerated UVs.",
    mutates: true,
    params: radialArrayCubesParamsSchema,
  },
  duplicate_hierarchy: {
    description:
      "Deep-copy one group subtree while preserving hierarchy, cube properties, and explicit UV policy.",
    mutates: true,
    params: duplicateHierarchyParamsSchema,
  },
  create_limb: {
    description:
      "Bone+cube with pivot at joint. Optional X mirror (arm_left/arm_right). Prefer for characters.",
    mutates: true,
    params: createLimbParamsSchema,
  },
  scaffold_biped: {
    description:
      "BEST START for humanoids: Steve-like biped bones+cubes+64² texture with correct pivots. Prefer over hand-placing limbs.",
    mutates: true,
    params: scaffoldBipedParamsSchema,
  },
  ensure_texture: {
    description:
      "Create or reuse a project texture (default 64×64 solid fill).",
    mutates: true,
    params: ensureTextureParamsSchema,
  },
  auto_uv_cubes: {
    description:
      "Auto-UV cubes. mode auto|box|face (default auto from Project/Format: java_block→face, Bedrock→box). Prefer pack_box_uv for unique islands.",
    mutates: true,
    params: autoUvCubesParamsSchema,
  },
  get_uv_layout: {
    description:
      "Inspect the atlas as semantic face islands: UV rect, flips, rotation, model-face texel size/density, bounds, and overlaps.",
    mutates: false,
    params: getUvLayoutParamsSchema,
  },
  get_uv_map: {
    description:
      "Render the selected texture with UV island borders and optional cube.face labels as a native MCP image preview.",
    mutates: false,
    params: getUvMapParamsSchema,
  },
  get_face_grid: {
    description:
      "Read exact face-local texels as RGBA rows while honoring rotated and flipped UVs.",
    mutates: false,
    params: getFaceGridParamsSchema,
  },
  get_texture_region: {
    description:
      "Return a nearest-neighbor zoom of one face or atlas region with checkerboard and pixel grid.",
    mutates: false,
    params: getTextureRegionParamsSchema,
  },
  analyze_texture_palette: {
    description:
      "Count exact RGBA colors and transparency for a texture or one face.",
    mutates: false,
    params: analyzeTexturePaletteParamsSchema,
  },
  get_texture_revision: {
    description:
      "Return a deterministic bitmap revision token for conflict-safe read-modify-write workflows.",
    mutates: false,
    params: getTextureRevisionParamsSchema,
  },
  audit_texture_quality: {
    description:
      "Audit per-face palette size, dominant base ratio, isolated pixels, flat fills, and optional glass alpha structure.",
    mutates: false,
    params: auditTextureQualityParamsSchema,
  },
  set_face_uv: {
    description:
      "Set exact per-face UV rectangles and optional quarter-turn rotation for multiple cube faces in ONE undo.",
    mutates: true,
    params: setFaceUvParamsSchema,
  },
  transform_uv_islands: {
    description:
      "Translate, scale, or quarter-turn selected UV faces around a shared pivot in one undo.",
    mutates: true,
    params: transformUvIslandsParamsSchema,
  },
  pack_box_uv: {
    description:
      "Pack unique UV islands before shade/paint. Auto-detects box vs per-face (java_block→face). Optional mode box|face|auto; auto_resize grows atlas.",
    mutates: true,
    params: packBoxUvParamsSchema,
  },
  resize_texture: {
    description:
      "Resize a texture with nearest-neighbor sampling and optionally rescale all UV coordinates in ONE undo.",
    mutates: true,
    params: resizeTextureParamsSchema,
  },
  shade_model_base: {
    description:
      "BEST texture base: assign texture, region colors by name regex, soft face lighting + mottle + blur (sosadly-style). Then paint features.",
    mutates: true,
    params: shadeModelBaseParamsSchema,
  },
  mirror_elements: {
    description: "Mirror named groups/cubes across an axis with smart rename.",
    mutates: true,
    params: mirrorElementsParamsSchema,
  },
  paint_face_feature: {
    description:
      "Paint one rect/ellipse/fill in face-local UV space. Prefer paint_face_features for batches.",
    mutates: true,
    params: paintFaceFeatureParamsSchema,
  },
  paint_face_features: {
    description:
      "Batch face-local paint ops (fill/rect/ellipse/line) in ONE undo — eyes, mouth, trim across many faces.",
    mutates: true,
    params: paintFaceFeaturesParamsSchema,
  },
  paint_pixel_batch: {
    description:
      "Batch pixel brush paths in face-local UV space. Square/circle brushes, clipped to each face by default, in ONE undo.",
    mutates: true,
    params: paintPixelBatchParamsSchema,
  },
  paint_face_grid: {
    description:
      "Write palette-indexed face-sized texel grids exactly, including transparent erase, in one undo.",
    mutates: true,
    params: paintFaceGridParamsSchema,
  },
  edit_texture_pixels: {
    description:
      "Set or erase exact atlas or face-local RGBA pixels in one undo.",
    mutates: true,
    params: editTexturePixelsParamsSchema,
  },
  replace_texture_color: {
    description:
      "Replace or erase a color globally or on one face with bounded RGBA tolerance.",
    mutates: true,
    params: replaceTextureColorParamsSchema,
  },
  copy_face_pixels: {
    description:
      "Copy face pixels to another face with optional mirror and quarter-turn rotation.",
    mutates: true,
    params: copyFacePixelsParamsSchema,
  },
  flood_fill_texture: {
    description:
      "Flood-fill a bounded face-local or atlas region with tolerance, transparency, and pixel caps.",
    mutates: true,
    params: floodFillTextureParamsSchema,
  },
  transform_texture_region: {
    description:
      "Flip or quarter-turn a full face or bounded atlas region without resampling.",
    mutates: true,
    params: transformTextureRegionParamsSchema,
  },
  import_texture_png: {
    description:
      "Import a PNG only from the user-approved scoped directory into a texture.",
    mutates: true,
    params: importTexturePngParamsSchema,
  },
  export_texture_png: {
    description:
      "Export a texture as original-resolution PNG inside the user-approved scoped directory.",
    mutates: true,
    params: exportTexturePngParamsSchema,
  },
  get_texture: {
    description:
      "Inspect the texture sheet as a compact PNG data_url (default max_edge 256).",
    mutates: false,
    params: getTextureParamsSchema,
  },
  assign_texture: {
    description:
      "Assign an existing texture to cubes, optionally limited to selected faces, in ONE undo.",
    mutates: true,
    params: assignTextureParamsSchema,
  },
  audit_material_set: {
    description:
      "Validate base/emissive/normal/specular texture channel dimensions, power-of-two sizes, and naming.",
    mutates: false,
    params: auditMaterialSetParamsSchema,
  },
  ensure_material_set: {
    description:
      "Create or reuse a bounded base/emissive/normal/specular texture set with channel-appropriate fills.",
    mutates: true,
    params: ensureMaterialSetParamsSchema,
  },
  inspect_animation: {
    description:
      "Read exact bone animation channels, key times, and vector values for safe iterative editing.",
    mutates: false,
    params: inspectAnimationParamsSchema,
  },
  upsert_animation: {
    description:
      "Create/replace a real bone animation clip with rotation/position/scale keys and linear/catmullrom/step interpolation.",
    mutates: true,
    params: upsertAnimationParamsSchema,
  },
  transform_animation_keys: {
    description:
      "Retiming, value scaling, and axis-aware mirroring for bounded animation bone keyframes in one undo.",
    mutates: true,
    params: transformAnimationKeysParamsSchema,
  },
  delete_animation: {
    description: "Delete one animation by name in a single undo step.",
    mutates: true,
    params: deleteAnimationParamsSchema,
  },
  propose_scoped_directory: {
    description:
      "Ask user to allow session file access under an absolute directory.",
    mutates: false,
    params: z.object({ path: z.string().min(1) }).strict(),
  },
  save_project: {
    description:
      "Compile the open project as a real .bbmodel inside the confirmed scoped directory. overwrite must be explicit.",
    mutates: true,
    params: z
      .object({
        path: z
          .string()
          .min(1)
          .regex(/\.bbmodel$/i, "path must end in .bbmodel"),
        overwrite: z.boolean().optional(),
      })
      .strict(),
  },
  export_model: {
    description:
      "Compile the open model through its active format codec into the confirmed scoped directory. overwrite must be explicit.",
    mutates: true,
    params: z
      .object({
        path: z.string().min(1),
        overwrite: z.boolean().optional(),
      })
      .strict(),
  },
} as const satisfies Record<string, CommandSpec>;

export type CommandName = keyof typeof COMMAND_SPECS;
export const COMMAND_NAMES = Object.keys(COMMAND_SPECS) as CommandName[];

export function isCommandName(value: string): value is CommandName {
  return value in COMMAND_SPECS;
}
