# Pixel-art construction rules

## Contents

1. Design contract
2. Geometry and silhouette
3. Palette and value structure
4. Pixel placement
5. Transparent glass
6. Reference recreation
7. Visual acceptance tests

## Design contract

Before building, record the subject and pose, three identifying silhouette features, relative proportions, materials, light direction, palette roles, focal region, permitted detail density, transparency or emission behavior, and reference-preservation requirements. If these cannot be stated, inspect or ask before painting.

## Geometry and silhouette

- Use the fewest cubes that preserve the identifying silhouette.
- Separate parts only when they change the outline, articulate, or require a distinct material boundary.
- Check the silhouette untextured. At small scale, ears, muzzle, paws, tail, and stance must read without color.
- Never leave coincident coplanar visible faces. They are a hard failure because they can
  flicker or swap draw order across cameras, GPUs, exports, and game renderers.
- Prefer painting flat seams, straps, panels, and markings into the supporting face. When
  geometry is required for silhouette or material depth, offset its visible face outward
  by at least `0.1` Blockbench units from the supporting face. Do not use microscopic
  epsilon offsets below `0.1` as a workaround.
- For stacked shells, rails, lids, cuffs, and armor, trim the hidden layer so the pieces
  meet at a boundary. Do not let their exterior faces share the same X, Y, or Z plane over
  an overlapping area. Intersections are allowed only when every potentially visible
  surface has a deliberate depth ordering of at least `0.1` units.
- Treat coats, capes, skirts, hair, sleeves, cuffs, boots, and other layered wearables as
  enclosing shells. Audit all exposed directions, not only the camera-facing side: an
  outer garment must extend beyond the covered body or limb on every visible axis by at
  least `0.1` units. In particular, check coat tails against both legs from the back and
  side; matching rear Z planes or matching outer X planes are hard failures.
- Do not rely on `inflate` to resolve coincident geometry; explicitly size the cubes so the
  separation survives export.
- Use consistent thickness for paired parts, then introduce asymmetry only where it supports the design.

### Mandatory z-fighting gate

Before texturing and again before delivery:

1. Inspect cube bounds, including transformed or mirrored parts.
2. For each face plane, find other faces on the same axis and coordinate whose two remaining
   coordinate ranges overlap.
3. Remove hidden duplicate faces where the format permits; otherwise trim, merge, or offset
   the responsible cube by at least `0.1` units.
4. Check overlays, body/rail seams, lids, armor, layered garments against limbs, hair against
   the head, eyes, decals, transparent layers, and mirrored center seams explicitly. Inspect
   both front and back plus one side; these are the common failure regions.
5. Orbit or capture at least one oblique view after the coordinate audit. Any shimmer, moire,
   intermittent pixel row, or face-color switching fails the gate.

Document every intentional intersection. `check_model` overlap findings may be accepted only
when the exposed faces have distinct depth ordering and cannot become coplanar during animation.

### Six-face enclosure test for layered parts

Apply this test to each outer/inner pair such as coat/leg, cape/body, hair/head, cuff/arm,
boot/leg, armor/body, or decal/support:

1. Record both cubes' `from` and `to` bounds after transforms. Do not judge from the editor grid.
2. Identify which outer faces can remain visible while the inner part occupies the same
   projected region.
3. For every such direction, require the outer bound to pass the inner bound by at least
   `0.1`: `outer.minX <= inner.minX - 0.1`, `outer.maxX >= inner.maxX + 0.1`, and likewise
   for Y and Z where that shell is meant to cover the inner part.
4. If the outer layer should not enclose a direction, trim it so the two parts stop
   overlapping there. Never leave equal bounds and assume the hidden face will not render.
5. For split garments, test every panel against every limb it overlaps. A left and right
   coat tail must each be checked against its corresponding leg; checking the torso alone
   is insufficient.
6. Re-read the edited bounds, then capture front, back, one side, and isometric views.
   Reject colored speckle, striped noise, moire, intermittent pixels, or switching face
   colors at any seam.

Example: if a leg spans `Z=-2..2`, a coat tail covering both front and back must use at
least `Z=-2.1..2.1`; using `Z=-1.9..2` still leaves the rear faces coincident and will
z-fight even when the front view looks clean.

## Palette and value structure

- Assign colors by role: transparent/base, base, light, highlight, shadow, deep accent, and optional outline.
- Keep a stable base over most of a material region. A useful starting range is 60–80%, adjusted for the subject.
- Separate adjacent structural planes by value or hue, not random noise.
- Highlights describe planes facing the light; shadows describe occlusion, undersides, and planes facing away.
- Do not alternate colors merely to fill pixels. Every non-base pixel must describe form, material, or an identifying feature.
- Check the palette in grayscale. The focal feature and silhouette edges must remain legible.

## Pixel placement

- Author face-sized grids using exact UV dimensions.
- Prefer short stepped clusters, corner accents, and controlled one-pixel breaks.
- Avoid long straight highlight bars unless the material is intentionally polished and the bar follows a plane.
- Avoid isolated noise. A single pixel must be an intentional sparkle, eye, joint, corner, or texture break.
- Keep paired parts related but not mechanically identical. Mirror structure first; vary only a few secondary pixels.
- Reserve the strongest contrast for the focal region and silhouette-critical edges.

## Transparent glass

Glass is defined by edges and refraction cues, not by filling every face with pale blue.

- Use transparent base pixels with low-to-medium alpha.
- Use higher-alpha edge pixels at corners, lower rims, joints, and silhouette breaks.
- Place small bright highlights on planes facing the light. Use one secondary reflected hue sparingly.
- Keep broad central regions more transparent than edges so the form reads as hollow or translucent.
- Darken selected far edges to imply thickness. Do not outline every edge equally.
- Allow internal overlaps to show, but prevent coincident faces from producing opaque noise.
- On a dark viewport, verify highlights; on a light viewport, verify edge alpha and silhouette.
- For a glass creature, keep eyes, nose, or another focal feature more opaque so the character remains readable. If transparent sorting or downscaling still hides those pixels, add thin focal-detail geometry with unique UV space; never paint duplicate faces on the back.

Suggested alpha roles:

| Role | Alpha range |
| --- | --- |
| broad transparent base | 20–45% |
| lit plane | 35–60% |
| silhouette edge | 55–80% |
| sparkle/focal highlight | 80–100% |
| opaque focal feature | 90–100% |

## Reference recreation

- Measure reference landmarks before modeling: bounding box, head/body ratio, limb lengths, and major color boundaries.
- Build a correspondence table from reference region to model group and UV face.
- Match color roles and coordinates. Do not replace missing evidence with decorative detail.
- When exact recreation is requested, translate reference pixels into the current UV layout; do not hard-code a known asset by name.
- When original work is requested, use references only for visual grammar. Author new geometry and new grid layouts.

## Visual acceptance tests

Accept only when all relevant checks pass: silhouette reads at approximately 128 pixels tall; focal feature reads without zooming; light direction is consistent; no face appears accidentally flat, noisy, or camouflage-like; material identity is obvious; paired parts remain coherent; front, side, and isometric views agree; the atlas has no unintended overlap; the mandatory coordinate-level z-fighting gate passes; and `check_model` has no unresolved findings.

