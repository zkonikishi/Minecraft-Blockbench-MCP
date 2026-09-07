<p align="right">
  <a href="./README.md">English</a> |
  <a href="./docs/README.zh-CN.md">简体中文</a>
</p>

# BlockBenchMCP

Minecraft-oriented **[Model Context Protocol](https://modelcontextprotocol.io/)** as a **pure Blockbench desktop plugin** (≥ 5.1.0).

Install the plugin → it hosts loopback HTTP MCP → point Cursor at the URL. **No separate Node adapter.** Closing Blockbench stops MCP.

Intent-level tools (`scaffold_biped`, `check_model`, …) — not a thin UI mirror.

## Install

**Artifact (recommended):** download `blockbench_mcp.js` from [GitHub Releases](https://github.com/SwagRee/BlockBenchMCP/releases).

From source:

```bash
git clone https://github.com/SwagRee/BlockBenchMCP.git
cd BlockBenchMCP
npm install && npm run build
```

Output: `packages/plugin/dist/blockbench_mcp.js`.

1. Blockbench: **File → Plugins → Load Plugin from File**
2. Allow **network / net** when prompted
3. Listens on `http://127.0.0.1:39741/mcp` (or Tools → Start / Stop MCP Server)
4. Settings: port + Bearer (default `dev-local-secret`)

## Cursor

```json
{
  "url": "http://127.0.0.1:39741/mcp",
  "headers": { "Authorization": "Bearer dev-local-secret" }
}
```

Open Blockbench first, enable MCP, call `health`.

## Architecture

```
AI client  --HTTP MCP-->  packages/plugin (inside Blockbench)
```

| Package  | Role                                             |
| -------- | ------------------------------------------------ |
| `shared` | Zod, guides, tool contracts, tests               |
| `plugin` | Desktop plugin; in-process HTTP MCP + Host ports |

Security: loopback only; Bearer required; file export needs `propose_scoped_directory` confirmation.

## Scope (v1)

| Format                                   | Priority     |
| ---------------------------------------- | ------------ |
| `java_block`                             | P0           |
| `geckolib_model` (needs GeckoLib plugin) | P0           |
| `bedrock` / `bedrock_old` entities        | Supported    |
| Generic free-model / mesh brush          | Out of scope |

**Non-goals:** `trigger_action` / `emulate_clicks` / `risky_eval`, full paint UI, Hytale, etc.

## Main tools

| Area         | Tools                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover     | `health`, `list_formats`, `get_project_summary`, `get_elements`, `get_guide`                                                                                                                                                                                                                                                                                                                            |
| Review       | `check_model`, `capture_views`, `analyze_view_silhouette`                                                                                                                                                                                                                                                                                                                                               |
| Project      | `create_project`, `set_project_meta`                                                                                                                                                                                                                                                                                                                                                                    |
| Geometry     | `scaffold_biped`, `apply_geometry_batch`, `update_elements`, `transform_elements`, `array_cubes`, `radial_array_cubes`, `duplicate_hierarchy`, `measure_model`, `audit_symmetry`, `create_limb`, `mirror_elements`                                                                                                                                                                                      |
| UV & texture | `ensure_texture`, `ensure_material_set`, `audit_material_set`, `pack_box_uv`, `get_uv_layout`, `get_uv_map`, `transform_uv_islands`, `paint_face_grid`, `get_face_grid`, `get_texture_revision`, `edit_texture_pixels`, `flood_fill_texture`, `transform_texture_region`, `replace_texture_color`, `copy_face_pixels`, `analyze_texture_palette`, `audit_texture_quality`, `get_texture_region`, PNG IO |
| Animation    | `inspect_animation`, `upsert_animation`, `transform_animation_keys`, `list_animations`, `delete_animation`                                                                                                                                                                                                                                                                                              |
| Files        | `propose_scoped_directory`, `save_project`, `export_model`                                                                                                                                                                                                                                                                                                                                              |

Mutations return explicit success/failure; unknown params hard-error. Prefer `check_model` over vision spam.

The safe edit loop is complete: inspect exact element geometry and per-face UVs with
`get_elements`, make bounded changes with `update_elements` / `set_face_uv`, then read
back and review. `save_project` writes a real `.bbmodel`; `export_model` compiles through
the active format codec. Both require an approved scoped directory and explicit overwrite.

Iterative modeling no longer requires recomputing every absolute coordinate:
`transform_elements` applies relative translation, scaling, and pivoted rotation;
`array_cubes` builds repeated geometry while explicitly sharing or regenerating UVs.
`measure_model` reports overall or subtree bounds, center, size, cube count, and volume,
while `audit_symmetry` reports left/right coordinate error. Dimension changes can choose
`uv_policy: preserve|auto`; re-check the UV layout before painting.

Advanced iteration adds rotation- and parent-hierarchy-aware world bounds, radial arrays,
deep hierarchy duplication, island-level UV transforms, and explicit intentional-overlap declarations. `ensure_material_set` creates channel sheets and `audit_material_set` validates
base/emissive/normal/specular channel consistency without pretending Blockbench formats all
export the same material semantics. `analyze_view_silhouette` turns multi-view captures into
numeric bounds and coverage, while animation keys can be inspected, retimed, scaled, or mirrored.

## Workflow

1. `get_guide(modeling)`
2. `create_project`
3. Entities: `scaffold_biped` / blocks: `apply_geometry_batch`
4. Fix errors, then texture
5. `pack_box_uv` → `get_uv_layout` (zero out-of-bounds; review overlaps/density) → `get_uv_map` → paint → `get_texture` / `capture_views`
6. `capture_views` only if needed

For a real Blockbench integration gate, open a disposable project with the plugin loaded and run
`npm run test:e2e`. The command requires an explicit disposable confirmation and performs a live
create → geometry → UV → paint → audit → multi-view sequence; it is intentionally separate from
the deterministic unit suite.

`capture_views` and `get_texture` return native MCP image content so compatible
clients can render previews directly. For crisp pixel work, `paint_pixel_batch`
accepts multiple face-local paths with square or circle brushes, clips them to
their UV faces by default, and commits the whole batch as one undo step.

Each orthographic capture also reports `visible_face` (`north`, `south`, etc.).
This names the model face looking toward the camera; isometric captures report
`null`. Use it to place focal details deliberately instead of guessing front-face
orientation from a prior project.

`get_uv_layout` provides machine-readable islands, overlap pairs, texel density,
flips, rotation, and bounds. `get_uv_map` returns a labeled atlas preview.
Face-local painting honors rotated/flipped UVs; subset packing preserves existing
islands by default, and `resize_texture` can scale the bitmap and all UVs together.

For precision pixel art, `paint_face_grid` writes an exact palette-indexed grid
whose dimensions must match the face; palette values support CSS RGBA and `null`
for true transparent erase. `get_face_grid` reads the exact RGBA texels back in
the same face-local orientation. Surgical editing, tolerant color replacement,
face copy/mirror/rotation, palette statistics, and checkerboard pixel zooms are
also available. PNG import/export is confined to a directory explicitly approved
with `propose_scoped_directory`.

Long-running agents can use `get_texture_revision` and pass its token as
`expected_revision` to destructive texture operations; stale edits fail instead
of overwriting newer work. Bounded flood fill and lossless face/region transforms
cover enclosed areas and symmetry fixes. `audit_texture_quality` turns pixel-art
rules into per-face findings for palette excess, weak base coverage, isolated
pixels, flat fills, and optional transparent-glass edge/center alpha structure.

Check `uv_mode` on `health` / `get_project_summary`: `java_block` → face; Bedrock → preserve the project's box or per-face UV mode.

## Bedrock workflow

- Create a separate entity tab without GeckoLib: `create_project({format:"bedrock", name:"Costume", geometry_name:"costume", uv_mode:"face", texture_width:256, texture_height:256})`.
- Use `bedrock_old` only when legacy export is required. UV modes unsupported by the installed format are rejected before creating a project.
- Existing tabs are preserved. A missing native creation API fails rather than opening a wizard that could leave the reference active.
- `update_elements` immediately refreshes transforms and visibility. Bone undo data is separate from cube undo data.
- `transform_elements` transforms an entire selected subtree once, even if children are also selected. Coordinates are in the selected root's parent space. Rotation is composed around the requested pivot; non-uniform scale of rotated/inflated geometry is rejected because cuboids cannot represent shear.
- `capture_views` uses an offscreen orthographic camera fitted to visible geometry, including bone rotations and inflation. It does not translate the model or change the user's camera.
- Saving still requires `propose_scoped_directory` confirmation, desktop module permission, and `overwrite:true` for existing files. `save_project` writes editable `.bbmodel`; `export_model` uses the current Bedrock codec for geometry JSON. They are different deliverables.

Validation: `npm test` includes shared contracts and mocked desktop-host regressions; `npm run typecheck` and `npm run build` validate the plugin. The destructive live smoke suite is **not** part of `npm test`: run it only with a disposable project. Reload `packages/plugin/dist/blockbench_mcp.js` in Blockbench to activate a newly built version; an already running MCP server continues using its loaded code until reload.

## Agent skill

Pixel-art modeling playbook: [`skills/blockbench-pixel-art/openai`](./skills/blockbench-pixel-art/openai/SKILL.md).

## License

MIT
