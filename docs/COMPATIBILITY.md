# BetterModel / ModelEngine authoring profiles

Profiles were checked against the primary references below on 2026-09-07. They express documented authoring constraints, not tested server compatibility across all versions.

Use Generic (`free`) with bone-parented cubes for a portable base. Face north (-Z), use Y=0 as ground and 16 model pixels per block. The ModelEngine profile warns about cube rotations outside the documented one-axis 0/±22.5/±45-degree set; bone rotations are a different capability. Keep engine-specific variants when adding advanced behavior.

BetterModel documents BB4/5 support, limited mesh UV support, Molang, Bezier and IK; armature/spline/billboard are unsupported. ModelEngine documents named default states, override behavior, special bone tags, square primary hitboxes and current Bezier-to-linear fallback. An empty animation slot has no authored motion. `mc_create_animation_set` creates missing slots only, and `both` uses common state names.

The audit checks names and references, group/outliner layout in BB4/5, cube bounds, texture references, UV bounds, default-state hints, keyframe times, primary hitbox shape and actual hitbox keyframes. It does not evaluate Molang, render every frame, decode every PNG, validate all custom tags or prove Minecraft performance. Empty preview-created bone animator records do not count as animated hitboxes.

`mc_set_bone_behavior` covers attachment, segment/tail and player-limb tags, including `limb[type=...]`. It preserves UUIDs, replaces a recognized tag instead of stacking it, rejects normalized ID collisions and checks direct geometry. Segment bones can retain child bones. Renaming does not configure server mechanics or prove runtime behavior.

## Official Wiki profile (Alpha 2)

The user supplied https://wiki.mythiccraft.io/modelengine as the adaptation basis. `mc_modelengine_features` separates implemented authoring tools, reference-only features and unverified runtime capabilities. The Wiki pages report 2026-08-19 updates but do not identify the user's exact Dev build. The profile reports `devBuild: null` and `runtimeVerified: false`.

Example: call `mc_set_bone_behavior` with `target: "modelengine"`, a bone UUID and `behavior: "tail_front"`; for `behavior: "player_limb"`, also provide `limb_type`, such as `"right_forearm"`. Query `mc_modelengine_features` for the complete enum. The helper supports one recognized behavior tag per bone, not arbitrary composite tags. New checks cover ID collisions, direct geometry and AABB dimensions; OBB remains rectangular-capable.

Scriptable keyframes are **reference-only**. The [official instructions](https://wiki.mythiccraft.io/modelengine/Modeling/Scriptable-Keyframes) describe effects-timeline instructions for MythicMobs skills and ModelEngine commands. This MCP has no dedicated script-keyframe writer or server execution verification. Runtime skins, mounts, custom renderers and other server APIs remain outside the editor plugin.

## Primary references

- [BetterModel support range](https://github.com/toxicity188/BetterModel/wiki/BlockBench-support-range)
- [BetterModel animation](https://github.com/toxicity188/BetterModel/wiki/Animating-your-own-model)
- [BetterModel custom hitbox](https://github.com/toxicity188/BetterModel/wiki/Configuring-custom-hitbox)
- [BetterModel bone tags](https://github.com/toxicity188/BetterModel/wiki/Configuring-bone-tag)
- [ModelEngine creating a model](https://wiki.mythiccraft.io/modelengine/Modeling/Creating-a-Model)
- [ModelEngine animation](https://wiki.mythiccraft.io/modelengine/Modeling/Animating-a-Model)
- [ModelEngine bone behaviors](https://wiki.mythiccraft.io/modelengine/Modeling/Bone-Behaviors)

## Acceptance checklist for a real server

Import an exported `.bbmodel` using the installed engine version's official procedure. Check resource-pack generation logs, distribute/reload the pack, spawn the model and verify scale, ground level, materials, all animation transitions, hitboxes and optional mounting. Test with a real Minecraft client. Record exact plugin/client versions and observations separately for each engine. None of these server/client gates was performed by the initial Alpha authoring test.
