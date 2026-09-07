/** Modeling playbook — proportions, pivots, hierarchy. Keep actionable and short. */
export const GUIDE_MODELING = `
# Modeling (Minecraft / Blockbench 5.1+)

## Mandatory workflow (do not skip)
1. get_guide(modeling) then create_project(format). Bedrock entities: format="bedrock" (or "bedrock_old" for legacy exports), no GeckoLib plugin required. Supply uv_mode="face" or "box" explicitly when matching a reference; geometry_name sets the export identifier. Existing project tabs are preserved.
2. Entities: scaffold_biped FIRST (correct pivots). Blocks: apply_geometry_batch.
3. check_model immediately. Fix every error before texturing.
4. Use measure_model instead of hand-calculating extents; it accounts for cube and parent rotations. Use transform_elements for relative edits, array_cubes/radial_array_cubes for bounded repetition, and duplicate_hierarchy for rig variants; audit_symmetry for explicit left/right pairs. Group transforms include all descendants, deduplicate selected parent/child refs, and use parent-space coordinates. Non-uniform scaling of rotated/inflated parts is rejected rather than introducing shear.
5. When cube dimensions change, choose uv_policy preserve or auto deliberately. Re-run get_uv_layout before painting. Use transform_uv_islands for intentional island-level layout edits.
6. Texturing: pack_box_uv → shade_model_base → paint_face_features. (scaffold_biped already packs in the project UV mode.)
7. capture_views only after check_model is clean (max_edge 256). Screenshots automatically frame visible rotated/inflated geometry without moving the model or the selected camera. Use analyze_view_silhouette for numeric multi-view bounds and small-preview coverage.

## UV mode (do not mix blindly)
- Read uv_mode from health / get_project_summary first.
- java_block → per-face (face). Bedrock supports box or face UV; preserve the reference project mode. Skin / geckolib-style usually uses box.
- Geometry tools + pack_box_uv / auto_uv_cubes follow Project/Format; override only with mode box|face.
- Never force box UV on a java_block project (and vice versa) unless you mean to.

## Proportions
- Even integer sizes (2/4/6/8). Silhouette first; 8–20 cubes beats 80.
- Biped scale=1: head 8³, body 8×12×4, limbs 4×12×4; feet on y=0.

## Pivots
- Joints, not centers. Legs=hip top, arms=shoulder, head=neck.
- create_limb hangs cube from pivot — keep that default.

## Hierarchy
- root → body → head/arm_*/leg_*. Animate bones only.
- Empty groups / zero-volume cubes are errors.
`.trim();

export const GUIDE_TEXTURING = `
# Texturing

1. ensure_texture (64 entities / 16 blocks), then pack_box_uv. Subset packing preserves other islands by default; auto-resize uses power-of-two atlases.
2. get_uv_layout before painting. Require summary.out_of_bounds=0 and review every overlap; compare density across related faces.
3. get_uv_map to visually verify island placement, face orientation, flips, and rotation. transform_uv_islands can translate/scale/quarter-turn selected islands without repacking the atlas.
4. Optional fast base: shade_model_base(seed, crisp:true, noise:0, blur:0). For authored work, call get_texture_revision before a long edit and pass expected_revision to precision mutations so stale plans cannot overwrite newer paint.
5. Author exact face-sized grids with paint_face_grid; get_face_grid returns lossless RGBA plus the same snapshot revision for read-modify-write.
6. Use paint_face_features / paint_pixel_batch for accents, edit_texture_pixels for surgical RGBA edits, replace_texture_color for palette revisions, and copy_face_pixels for mirrored parts.
7. Use flood_fill_texture only with a face or a conservative max_pixels; use transform_texture_region for lossless flips/turns. Run analyze_texture_palette and audit_texture_quality (glass:true for transparent materials).
8. Prefer 4–8 intentional colors and a 60–80% stable material base. Inspect get_texture_region(face, scale:8+, grid:true), get_uv_map, and model views. Fix findings and re-check_model.
9. PNG import/export requires propose_scoped_directory and stays inside that user-approved folder. Use resize_texture when bitmap and UVs must scale together. ensure_material_set creates base/emissive/normal/specular sheets; audit_material_set checks their dimensions and naming before export.
`.trim();

export const GUIDE_ANIMATION = `
# Animation

1. Rig first (scaffold_biped / create_limb). Never keyframe loose cubes.
2. Idle: tiny body bob + head sway. Walk: opposite-phase limbs, few keys.
3. inspect_animation reads exact key data before revision. transform_animation_keys handles bounded retiming, value scale, and axis-aware mirroring.
4. upsert_animation(replace:true) for full replacement. Then check_model + capture_views.
`.trim();

export const GUIDE_JAVA_BLOCK = `
# java_block

- Per-face UV (uv_mode=face). Geometry + pack_box_uv use face packing, not box UV.
- Prefer geometry inside 0..16. One 16×16 (or packed) texture.
- apply_geometry_batch for multi-cube shapes in one undo.
- check_model before export.
`.trim();

export const GUIDE_GECKOLIB = `
# geckolib_model

- Requires GeckoLib plugin (capability geckolib).
- Typically box UV; scaffold_biped / pack_box_uv follow project mode.
- Start scaffold_biped; stable snake_case bone names.
- propose_scoped_directory before export_model.
`.trim();
