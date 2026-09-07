# BetterModel / ModelEngine authoring profiles

Profiles were checked against the primary references below on 2026-09-07. They express documented authoring constraints, not tested server compatibility across all versions.

Use Generic (`free`) with bone-parented cubes for a portable base. Face north (-Z), use Y=0 as ground and 16 model pixels per block. The ModelEngine profile warns about cube rotations outside the documented one-axis 0/±22.5/±45-degree set; bone rotations are a different capability. Keep engine-specific variants when adding advanced behavior.

BetterModel documents BB4/5 support, limited mesh UV support, Molang, Bezier and IK; armature/spline/billboard are unsupported. ModelEngine documents named default states, override behavior, special bone tags, square primary hitboxes and current Bezier-to-linear fallback. An empty animation slot has no authored motion. `mc_create_animation_set` creates missing slots only, and `both` uses common state names.

The audit checks names and references, group/outliner layout in BB4/5, cube bounds, texture references, UV bounds, default-state hints, keyframe times, primary hitbox shape and actual hitbox keyframes. It does not evaluate Molang, render every frame, decode every PNG, validate all custom tags or prove Minecraft performance. Empty preview-created bone animator records do not count as animated hitboxes.

`mc_set_bone_behavior` renames a uniquely resolved bone. Empty mount and seat bones are enforced. Hitbox geometry and server mechanics remain separate setup; renaming is not sufficient to deploy a working mount or combat hitbox. Re-running a prefix rename can add another prefix, so inspect the current name before invoking it again.

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
