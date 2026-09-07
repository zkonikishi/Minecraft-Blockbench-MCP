import type { SessionState } from "./session.js";
import { toErrorPayload } from "./errors.js";
import { buildProjectSummary } from "./bb/summary.js";
import { runCheckModel } from "./check/rules.js";
import { captureViews } from "./views/capture.js";
import { createProject } from "./bb/project.js";
import { applyGeometryBatch } from "./geometry/batch.js";
import { createLimb } from "./geometry/limb.js";
import { scaffoldBiped } from "./geometry/biped.js";
import { ensureTexture } from "./texture/ensure.js";
import { getTexture } from "./texture/get.js";
import {
  autoUvCubes,
  getUvLayout,
  getUvMap,
  paintFaceFeature,
  paintFaceFeatures,
  packBoxUv,
  shadeModelBase,
} from "./paint/face-feature.js";
import { mirrorElements } from "./geometry/mirror.js";
import {
  proposeScopedDirectory,
  exportModel,
  saveProject,
} from "./commands/scope-export.js";
import { upsertAnimation } from "./commands/animation.js";
import { paintPixelBatch } from "./paint/pixel-batch.js";
import { resizeTexture } from "./texture/resize.js";
import {
  copyFacePixels,
  editTexturePixels,
  getFaceGrid,
  paintFaceGrid,
  replaceTextureColor,
} from "./paint/texture-pixels.js";
import {
  analyzeTexturePalette,
  getTextureRegion,
} from "./paint/texture-inspect.js";
import { exportTexturePng, importTexturePng } from "./texture/png-io.js";
import { getTextureRevision } from "./paint/texture-revision.js";
import {
  floodFillTexture,
  transformTextureRegion,
} from "./paint/texture-ops.js";
import { auditTextureQuality } from "./paint/texture-quality.js";
import { transformElements } from "./geometry/transform.js";
import { arrayCubes } from "./geometry/array.js";
import { auditSymmetry, measureModel } from "./geometry/measure.js";
import {
  duplicateHierarchy,
  radialArrayCubes,
} from "./geometry/advanced-array.js";
import { transformUvIslands } from "./paint/uv-transform.js";
import { auditMaterialSet, ensureMaterialSet } from "./texture/material-set.js";
import { analyzeViewSilhouette } from "./views/silhouette.js";
import {
  inspectAnimation,
  transformAnimationKeys,
} from "./commands/animation-edit.js";
import { requireProject } from "./bb/elements.js";
import { resolveGuide, type ProjectFormat } from "@blockbench-mcp/shared";
import {
  getElements,
  listAnimations,
  listFormats,
  listTextures,
} from "./bb/inspect.js";
import { setFaceUv, updateElements } from "./geometry/update.js";
import {
  assignTexture,
  deleteAnimation,
  setProjectMeta,
} from "./commands/management.js";

export async function dispatchCommand(
  session: SessionState,
  command: string,
  params: unknown,
): Promise<unknown> {
  try {
    switch (command) {
      case "list_formats":
        return { formats: listFormats() };
      case "get_project_summary":
        return buildProjectSummary();
      case "get_elements":
        return getElements((params ?? {}) as never);
      case "measure_model":
        return measureModel((params ?? {}) as never);
      case "audit_symmetry":
        return auditSymmetry((params ?? {}) as never);
      case "analyze_view_silhouette":
        return await analyzeViewSilhouette((params ?? {}) as never);
      case "list_textures":
        return { textures: listTextures() };
      case "list_animations":
        return { animations: listAnimations() };
      case "check_model":
        return runCheckModel((params ?? {}) as never);
      case "capture_views":
        return await captureViews((params ?? {}) as never);
      case "get_guide":
        return resolveGuide(
          (
            params as {
              topic?:
                | "modeling"
                | "texturing"
                | "animation"
                | "java_block"
                | "geckolib";
            } | null
          )?.topic,
        );
      case "create_project": {
        const p = params as {
          format: ProjectFormat;
          uv_mode?: "box" | "face";
          geometry_name?: string;
          name?: string;
          texture_width?: number;
          texture_height?: number;
        };
        const r = createProject(p);
        return { ok: true, undo_label: `create_project ${p.format}`, ...r };
      }
      case "set_project_meta":
        return setProjectMeta((params ?? {}) as never);
      case "apply_geometry_batch":
        return applyGeometryBatch((params ?? {}) as never);
      case "update_elements":
        return updateElements((params ?? {}) as never);
      case "transform_elements":
        return transformElements((params ?? {}) as never);
      case "array_cubes":
        return arrayCubes((params ?? {}) as never);
      case "radial_array_cubes":
        return radialArrayCubes((params ?? {}) as never);
      case "duplicate_hierarchy":
        return duplicateHierarchy((params ?? {}) as never);
      case "create_limb": {
        const r = createLimb((params ?? {}) as never);
        return { ok: true, undo_label: "create_limb", ...r };
      }
      case "scaffold_biped":
        return scaffoldBiped((params ?? {}) as never);
      case "ensure_texture": {
        const r = ensureTexture((params ?? {}) as never);
        return { ok: true, undo_label: "ensure_texture", created: [r] };
      }
      case "auto_uv_cubes":
        return autoUvCubes((params ?? {}) as never);
      case "get_uv_layout":
        return getUvLayout((params ?? {}) as never);
      case "get_uv_map":
        return await getUvMap((params ?? {}) as never);
      case "get_face_grid":
        return await getFaceGrid((params ?? {}) as never);
      case "get_texture_region":
        return await getTextureRegion((params ?? {}) as never);
      case "analyze_texture_palette":
        return await analyzeTexturePalette((params ?? {}) as never);
      case "get_texture_revision":
        return await getTextureRevision((params ?? {}) as never);
      case "audit_texture_quality":
        return await auditTextureQuality((params ?? {}) as never);
      case "set_face_uv":
        return setFaceUv((params ?? {}) as never);
      case "transform_uv_islands":
        return transformUvIslands((params ?? {}) as never);
      case "pack_box_uv":
        return packBoxUv((params ?? {}) as never);
      case "resize_texture":
        return resizeTexture((params ?? {}) as never);
      case "shade_model_base":
        return shadeModelBase((params ?? {}) as never);
      case "mirror_elements":
        return mirrorElements((params ?? {}) as never);
      case "paint_face_feature":
        return paintFaceFeature((params ?? {}) as never);
      case "paint_face_features":
        return paintFaceFeatures((params ?? {}) as never);
      case "paint_pixel_batch":
        return paintPixelBatch((params ?? {}) as never);
      case "paint_face_grid":
        return paintFaceGrid((params ?? {}) as never);
      case "edit_texture_pixels":
        return editTexturePixels((params ?? {}) as never);
      case "replace_texture_color":
        return replaceTextureColor((params ?? {}) as never);
      case "copy_face_pixels":
        return await copyFacePixels((params ?? {}) as never);
      case "flood_fill_texture":
        return await floodFillTexture((params ?? {}) as never);
      case "transform_texture_region":
        return await transformTextureRegion((params ?? {}) as never);
      case "import_texture_png":
        return await importTexturePng(session, (params ?? {}) as never);
      case "export_texture_png":
        return exportTexturePng(session, (params ?? {}) as never);
      case "get_texture":
        return getTexture((params ?? {}) as never);
      case "assign_texture":
        return assignTexture((params ?? {}) as never);
      case "audit_material_set":
        return auditMaterialSet((params ?? {}) as never);
      case "ensure_material_set":
        return ensureMaterialSet((params ?? {}) as never);
      case "inspect_animation":
        return inspectAnimation((params ?? {}) as never);
      case "upsert_animation":
        return upsertAnimation((params ?? {}) as never);
      case "transform_animation_keys":
        return transformAnimationKeys((params ?? {}) as never);
      case "delete_animation":
        return deleteAnimation((params ?? {}) as never);
      case "propose_scoped_directory":
        return proposeScopedDirectory(
          session,
          (params as { path: string }).path,
        );
      case "export_model":
        return exportModel(session, (params ?? {}) as never);
      case "save_project":
        return saveProject(session, (params ?? {}) as never);
      default:
        requireProject();
        throw Object.assign(new Error(`Unsupported command: ${command}`), {
          code: "E_UNSUPPORTED_COMMAND",
        });
    }
  } catch (err) {
    const payload = toErrorPayload(err);
    throw Object.assign(new Error(payload.message), { payload });
  }
}
