import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMMAND_NAMES,
  COMMAND_SPECS,
  MIN_BLOCKBENCH_VERSION,
  isBlockbenchSupported,
  isCommandName,
  resolveGuide,
} from "./index.js";

/** Contract smoke: the agent happy-path tools exist and guides push quality workflow. */
describe("generation smoke contract", () => {
  it("exposes the quality pipeline tools in order", () => {
    const pipeline = [
      "get_guide",
      "create_project",
      "scaffold_biped",
      "check_model",
      "measure_model",
      "ensure_texture",
      "pack_box_uv",
      "get_uv_layout",
      "get_uv_map",
      "get_face_grid",
      "paint_face_grid",
      "analyze_texture_palette",
      "get_texture_region",
      "get_texture_revision",
      "audit_texture_quality",
      "shade_model_base",
      "paint_face_features",
      "paint_pixel_batch",
      "get_texture",
      "capture_views",
      "analyze_view_silhouette",
    ] as const;
    for (const name of pipeline) {
      assert.equal(isCommandName(name), true, name);
      assert.ok(COMMAND_SPECS[name].description.length > 10);
    }
    assert.ok(COMMAND_NAMES.includes("apply_geometry_batch"));
    assert.ok(COMMAND_NAMES.includes("paint_face_feature"));
    assert.ok(COMMAND_NAMES.includes("auto_uv_cubes"));
    assert.ok(COMMAND_NAMES.includes("transform_elements"));
    assert.ok(COMMAND_NAMES.includes("array_cubes"));
    assert.ok(COMMAND_NAMES.includes("radial_array_cubes"));
    assert.ok(COMMAND_NAMES.includes("duplicate_hierarchy"));
    assert.ok(COMMAND_NAMES.includes("transform_uv_islands"));
    assert.ok(COMMAND_NAMES.includes("audit_material_set"));
    assert.ok(COMMAND_NAMES.includes("ensure_material_set"));
    assert.ok(COMMAND_NAMES.includes("inspect_animation"));
    assert.ok(COMMAND_NAMES.includes("transform_animation_keys"));
    assert.ok(COMMAND_NAMES.includes("audit_symmetry"));
    assert.ok(COMMAND_NAMES.includes("resize_texture"));
    assert.ok(COMMAND_NAMES.includes("edit_texture_pixels"));
    assert.ok(COMMAND_NAMES.includes("replace_texture_color"));
    assert.ok(COMMAND_NAMES.includes("copy_face_pixels"));
    assert.ok(COMMAND_NAMES.includes("import_texture_png"));
    assert.ok(COMMAND_NAMES.includes("export_texture_png"));
    assert.ok(COMMAND_NAMES.includes("flood_fill_texture"));
    assert.ok(COMMAND_NAMES.includes("transform_texture_region"));
  });

  it("exposes a complete safe read-modify-manage loop", () => {
    for (const name of [
      "list_formats",
      "get_elements",
      "update_elements",
      "set_face_uv",
      "list_textures",
      "assign_texture",
      "set_project_meta",
      "list_animations",
      "delete_animation",
      "save_project",
      "export_model",
    ] as const) {
      assert.equal(isCommandName(name), true, name);
    }
  });

  it("texturing guide prefers pack + shade before features", () => {
    const g = resolveGuide("texturing");
    assert.match(g.text, /pack_box_uv/i);
    assert.match(g.text, /get_uv_layout/i);
    assert.match(g.text, /get_uv_map/i);
    assert.match(g.text, /shade_model_base/i);
    assert.match(g.text, /paint_face_features/i);
  });

  it("guides explain java_block per-face vs box UV", () => {
    assert.match(resolveGuide("modeling").text, /uv_mode/i);
    assert.match(resolveGuide("java_block").text, /per-face|face/i);
  });

  it("modeling guide mandates scaffold + check before vision", () => {
    const g = resolveGuide("modeling");
    assert.match(g.text, /scaffold_biped/i);
    assert.match(g.text, /check_model/i);
    assert.match(g.text, /Mandatory workflow/i);
  });

  it("declares Blockbench 5.1 minimum", () => {
    assert.equal(MIN_BLOCKBENCH_VERSION, "5.1.0");
    assert.equal(isBlockbenchSupported("5.1.0"), true);
    assert.equal(isBlockbenchSupported("5.1.6"), true);
    assert.equal(isBlockbenchSupported("5.0.9"), false);
    assert.equal(isBlockbenchSupported("4.12.0"), false);
  });
});
