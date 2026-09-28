---
name: blockbench-pixel-art
description: Build, recreate, texture, and visually verify crisp pixel-art models in Blockbench through its local MCP server. Use for reference-image recreation, original voxel or cuboid characters, Minecraft-style skins, transparent or emissive materials, UV-aware texture painting, and iterative Blockbench model refinement where silhouette, palette, face orientation, pixel placement, and material readability must remain controlled.
---

# Blockbench Pixel Art

Create Blockbench models with deliberate geometry and texture decisions. Treat every preview as evidence; do not claim quality from a successful tool response alone.

## Required workflow

1. Read [references/blockbench-workflow.md](references/blockbench-workflow.md).
2. Read [references/pixel-art-rules.md](references/pixel-art-rules.md) before geometry or texture work.
3. Classify the request:
   - **Reference recreation:** preserve the supplied silhouette, proportions, palette relationships, and identifying pixels. Do not invent details that contradict the reference.
   - **Original design:** write a compact design contract covering silhouette, proportions, materials, palette, light direction, and detail density before building.
4. Inspect the live Blockbench project and available MCP tools. Call the modeling guide before creating entity geometry and the texturing guide before painting.
5. Block out geometry and verify the silhouette from at least two useful views before texturing.
   Before accepting the blockout, run the mandatory z-fighting gate in
   [references/pixel-art-rules.md](references/pixel-art-rules.md). A clean preview is not
   evidence that coincident faces are safe.
6. Pack UVs before painting. Give every visible face unique texel space unless intentional sharing is documented.
7. Write texture faces as palette-indexed grids. Compile them with `scripts/compile_texture_plan.py`; do not improvise large paint rectangles during fragile pixel work.
8. Apply the texture plan, run `check_model`, and capture a useful preview.
9. Compare the preview against the design contract or reference. Identify concrete defects by region, revise the grids, and repeat.
10. For layered character geometry, capture `front`, `back`, `side`, and `iso` views after
    the final geometry edit. Apply the six-face enclosure test in the pixel-art rules.
11. Finish only when geometry checks pass and the material, silhouette, focal features, and light direction remain readable at a small preview size.

## Deterministic helpers

- Use `scripts/blockbench_mcp.py` when Blockbench MCP tools are not exposed directly. It supports health checks, tool discovery, and JSON tool calls over the local HTTP endpoint.
- Use `scripts/compile_texture_plan.py SPEC.json -o ARGS.json` to convert palette grids into exact 1x1 `paint_face_features` operations.
- Keep reusable plans semantic. Name parts by role (`head`, `ear_left`, `body_glass`) rather than by a specific test subject.

## Quality gates

- Reject random per-pixel variation, camouflage-like clusters, long specular bars, and uniform flat fills unless the design contract explicitly requires them.
- Require a stable base color to occupy most of each material region. Place highlights and shadows according to form and light direction.
- For reference work, compare coordinates and color roles rather than relying on a verbal resemblance.
- For transparent materials, verify both silhouette visibility and interior transparency. Read the glass rules in [references/pixel-art-rules.md](references/pixel-art-rules.md).
- Never substitute an external texture for an original-design request. External images may be analyzed as references, but the applied grid must be authored for the current UV layout.
- Preserve the user's existing project unless replacement is explicitly authorized. Use separate undoable batches and report unsaved state.
- Reject geometry with coincident exposed faces. Surface decoration must be painted into
  the supporting face or offset outward by at least `0.1` Blockbench units; structural
  layers must meet at a boundary instead of occupying the same plane. Never waive this
  rule because z-fighting is absent from one camera angle or one GPU.
- Treat `OVERLAP` as a prompt for coordinate inspection, not as a harmless informational
  finding. Accept an overlap only after proving that every exposed face pair has at least
  `0.1` units of depth ordering in all views where both parts can be visible.

## Iteration discipline

After every preview, state only defects visible in that preview. Do not defend the output or repeat tool success messages. Revise the smallest responsible layer: geometry for silhouette errors, UVs for mapping errors, palette for value errors, and pixel grids for placement errors.
