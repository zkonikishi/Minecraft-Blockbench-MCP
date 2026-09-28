# Blockbench MCP workflow

## Connection

1. Prefer native MCP tools when present.
2. Otherwise run `scripts/blockbench_mcp.py health`.
3. The default endpoint is `http://127.0.0.1:39741/mcp`. Override it with `BLOCKBENCH_MCP_URL`.
4. Pass the shared secret with `BLOCKBENCH_MCP_SECRET`; do not print it.
5. Discover tools dynamically with `scripts/blockbench_mcp.py list`. Do not assume a tool remains available across plugin versions.

## Model sequence

1. Call `health`, `get_project_summary`, and `get_guide` with topic `modeling`.
2. Preserve the current project unless the user requests a replacement. For a new model, create a supported entity format with a deliberate texture size. If an entity format reports a missing plugin, record the limitation and fall back to another available cuboid format only when the requested geometry and texture semantics remain representable.
3. Build named groups and cubes in bounded geometry batches.
4. Use pivots at anatomical joints. Mirror only after one side has passed silhouette review.
5. Run a coordinate-level z-fighting audit before painting. For every pair of cubes whose
   projected areas overlap, compare all six face planes. No two visible faces may occupy
   the same plane. Paint flat decoration into the existing face; otherwise move the
   overlay outward by at least `0.1` units. Trim stacked shells so they meet at one boundary
   rather than overlapping with duplicate exterior faces. For characters, audit layered
   clothing against every covered limb from front, back, and side; never infer safety from
   checking only the front-facing Z plane.
6. Run `check_model` before painting. Fix overlaps, zero-size cubes, bad pivots, and untextured faces.
   `check_model` returning zero errors does not replace the coordinate-level z-fighting audit.
   For every `OVERLAP`, read both elements with `get_elements`, compare their transformed
   bounds using the six-face enclosure test, and record why the overlap is safe or fix it.
7. Capture two silhouette views. Texture cannot repair wrong proportions.

## Texture sequence

1. Call `get_guide` with topic `texturing`.
2. Create or select one texture and pack box UVs before painting.
3. Derive the front-face convention from the new model geometry and intended presentation. Do not inherit `north` or `south` from a previous project; confirm it in a rendered preview before painting focal features.
4. After UV packing, compare the reported `used` width and height with the requested texture size. Treat any overflow as failure even if the tool reports success; simplify geometry or UV islands instead of silently resizing.
5. Author palette-indexed grids using the actual face dimensions.
6. Compile the plan with `compile_texture_plan.py` and call `paint_face_features` with the resulting JSON arguments.
7. Inspect both `get_texture` and rendered model views. Atlas correctness does not prove correct face orientation.
8. Run `check_model` again after the final paint pass.
9. Re-run the z-fighting audit after any resize, inflate, mirror, or geometry refinement;
   these operations can recreate coincident planes after an earlier pass succeeded.

## Preview loop

- Use an isometric view for overall form and a front or side view for focal details.
- For layered characters, require front, back, side, and isometric views. A front/iso pair
  cannot validate coat tails, capes, hair, backpacks, or rear armor.
- Judge at both normal size and approximately 128 pixels tall.
- Write defects as region + cause + correction, for example: `front legs merge because both inner edges use the same dark run; break the run and restore the base value`.
- Change one layer at a time. Re-capture after every meaningful batch.
- Do not assume filesystem export is available merely because directory scoping succeeds. Preserve open project tabs and report unsaved state when export returns an environment error.

## Safe JSON call examples

```powershell
python scripts/blockbench_mcp.py call get_project_summary --args '{}'
python scripts/blockbench_mcp.py call capture_views --args '{"views":["iso"],"max_edge":384,"format":"jpeg","quality":75}'
python scripts/blockbench_mcp.py call paint_face_features --args-file texture-args.json
```



