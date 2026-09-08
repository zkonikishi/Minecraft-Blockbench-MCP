# Blockbench 5.1 creature workflow tools

Alpha 3 adds 16 dedicated tools to the existing 190-tool default Web catalogue. The tools use native editor objects, the existing serialized MCP lane and native Undo. No general JavaScript execution permission is needed. Tool schemas returned by `tools/list` are authoritative.

| Tool | Purpose |
| --- | --- |
| `mc_workflow_capabilities` | Read installed BB version and native API availability |
| `mc_mirror_animation` | Copy transform channels between explicit source/destination bones; native Molang/Bezier sign mirroring |
| `mc_mirror_animating` | Enable/disable native live mirroring and set phase in degrees |
| `mc_reparent_bone` | Native Preserve World Transform for one bone in Edit mode |
| `mc_bounding_box` | Create/update native authoring AABB from bounds or selected cube vertices |
| `mc_convert_hitbox` | Convert a root authoring AABB into primary, b_ or ob_ engine geometry |
| `mc_control_node` | Create Locator/NullObject; validate optional IK source/target ancestry |
| `mc_transform_keyframes` | Numeric/Molang keys, Bezier handles, global rotation and collision-aware replacement |
| `mc_script_keyframes` | Read/upsert/delete ModelEngine Instructions timeline |
| `mc_texture_workflow` | UV dimensions/remap, wrapping and per-texture flipbook FPS |
| `mc_preview_animation` | Sample exact pose and texture frame, or return to Edit mode |
| `mc_inspect_nodes` | Native saved properties and model-space matrices |
| `mc_animation_codec` | List installed AnimationCodecs; compile a clip without disk writes |
| `mc_collection` | List/create named native collections of explicit node members |
| `mc_export_collection` | Portable component `.bbmodel` with ancestors and relevant animation tracks |
| `mc_export_engine_variants` | Separate BetterModel/ModelEngine files and static reports |

## Animation

Author the source side with `mc_transform_keyframes`, then call:

```json
{"animation":"walk","source":"left_front_leg","destination":"right_front_leg","phase":0.5}
```

`phase` is a fraction of a looping animation. Include a source key at `(1-phase)*length` on each copied channel to retain the loop seam. Zero and final seam keys are emitted for phase-shifted loops. An occupied destination requires `replace:true`; source keys are preserved. Native keyframe mirroring handles rotation signs, position signs, Molang negation and Bezier value handles. The tool copies `rotation_global` too. This is explicit copying; enable `mc_mirror_animating` in Animate mode for subsequent native live edits. Use `mc_preview_animation` to enter Animate mode and sample a pose.

A hierarchy change preserves the **rest pose**, not animation retargeting. Use `mc_inspect_nodes` before/after to compare transforms. Reparent rejects cycles and requires Edit mode. Existing animation curves are not silently rewritten.

## Hitboxes and controls

`mc_bounding_box` takes either `from`/`to` or explicit cube `elements`, plus optional padding. Cube geometry is transformed to model space, including parent rotations. A `box` UUID updates an existing native box. Native authoring boxes are stored in the project; they are not automatically Minecraft collision geometry.

`mc_convert_hitbox` creates a new engine bone and one defining cube without removing the source box. Primary uses `hitbox`, AABB uses `b_`, OBB uses `ob_`. ModelEngine primary/AABB expands X/Z around the original center to a square and enforces positive dimensions at most 1024 pixels. OBB conversion creates an axis-aligned starting shape that can subsequently be rotated as a bone. Existing names are rejected instead of overwritten. Runtime behavior must still be checked in the engine version in use.

Locator/NullObject support is documented by BetterModel. IK requires both source and target, with target descending from source. This does not promise ModelEngine equivalence. The dual audit reports target-specific portability issues.

## Skill instructions

```json
{"animation":"attack","operation":"upsert","time":0.5,"script":"mm:creature_attack\npartvis{part=head;visible=true}"}
```

Read uses `operation:"read"`; delete uses `operation:"delete"` and time. Upsert replaces only Instructions keys at the requested time, leaving sound/particle channels alone. Supported command families: `mm:skill`, `changeparent`, `partvis`, `tint`, `enchant`, `tag`, `changepart`, `remap`. The whitelist validates instruction families and balanced outer braces, not the server's skill registry or every command argument. Missing skills and invalid server parameters remain runtime errors. Arbitrary JavaScript is not evaluated.

## Textures and collections

UV resizing preserves image pixels and can scale face UVs proportionally. It requires a format with per-texture UV dimensions. Box UV remapping is rejected until converted to face UV. `wrap` is `limited`, `repeat` or `clamp`; `fps` configures editor flipbook playback. `mc_preview_animation` synchronizes pose and texture preview at an exact time. The engine audit warns about non-default wrapping because editor tiling does not establish Minecraft atlas behavior.

Collections use explicit member UUIDs and do not change experimental multi-file scopes. Component export preserves ancestor transforms, filters unrelated geometry and animation tracks, embeds existing textures, and omits script/effect tracks whose dependencies cannot be inferred safely. It retains reference texture sheets rather than repacking them. A dangling member is rejected. This provides independent body/gear/attachment files in Web and Desktop without depending on filesystem APIs or experimental cross-scope rules.

Variant export removes only native authoring BoundingBoxes and produces independent static reports. It does not silently strip IK, flatten curves, rewrite engine tags or claim to generate server resource packs. Review each report; both files can contain identical shared geometry with different findings.

## Validation

`npm run check` covers type checks, 31 tests and bundling. `npm run test:upstream` covers 69 selected upstream tests. `node scripts/live-workflow.mjs --confirm-disposable` creates a new test project and verifies real Web authoring, world transforms under a rotated parent, Undo/Redo, mirrored seam times, script persistence and exports. Set `BLOCKBENCH_TEST_DIR` for evidence files and provide the relay token through the environment.

Server AI, MythicMobs skill execution, resource pack generation, exact ModelEngine Dev builds and actual Desktop execution are separate from these editor authoring checks.

## Sources

- [Blockbench 5.1 release and API changes](https://github.com/JannisX11/blockbench/releases/tag/v5.1.0)
- [Blockbench 5.1.6](https://github.com/JannisX11/blockbench/releases/tag/v5.1.6)
- [BetterModel support range](https://github.com/toxicity188/BetterModel/wiki/BlockBench-support-range)
- [ModelEngine scriptable keyframes](https://wiki.mythiccraft.io/modelengine/Modeling/Scriptable-Keyframes)
