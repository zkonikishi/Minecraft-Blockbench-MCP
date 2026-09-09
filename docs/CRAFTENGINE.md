# CraftEngine integration — Alpha 8

The profile targets CraftEngine 26.8.2, matching the inspected Beta installation. CraftEngine remains responsible for resource-pack generation, hosting and sending; the MCP creates content for that pipeline. Existing delivery credentials and settings are not modified.

## Tools

- `mc_craftengine_profile({})`: capabilities, limits and official references.
- `mc_craftengine_export(...)`: returns a file manifest for a CE content pack. It accepts a supplied bbmodel or compiles the active project without changing it.
- `mc_craftengine_pack_plan(...)`: returns two additive merge-list values. Preserve the surrounding `resource-pack` section, especially delivery and conflict handlers.

### Static item or furniture

Use a **Java Block/Item** project with per-face UV and embedded PNG textures. Generic animated creature projects are rejected instead of being flattened silently. Group rotations, mesh elements, missing textures and incompatible legacy rotations must be resolved in an export copy first.

```json
{
  "namespace": "my_pack",
  "id": "lamp",
  "pack": "my_blockbench_assets",
  "material": "paper",
  "display_name": "Lamp",
  "renderer": "blueprint",
  "furniture": true,
  "translation": [0, 0.5, 0],
  "hitbox": {"width": 1, "height": 1}
}
```

The manifest contains `pack.yml`, `blueprint/lamp.bbmodel` and `configuration/lamp.yml`. CE converts the blueprint, writes textures and creates the item-model mapping. `.yml` files intentionally use JSON syntax, accepted by CE's YAML loader. `translation` and hitbox dimensions use Minecraft blocks; model coordinates use Blockbench units. A hitbox is optional and is for interaction, not a solid collision block. Furniture currently creates a `ground` placement variant.

Save the returned manifest as JSON, then use the included installer:

```powershell
node scripts/install-craftengine-pack.mjs manifest.json 'D:/server/plugins/CraftEngine/resources'
node scripts/install-craftengine-pack.mjs manifest.json 'D:/server/plugins/CraftEngine/resources' --apply
```

The first invocation is a dry run. The installer refuses an existing destination, duplicate or escaping paths and malformed manifest content. Use a distinct pack directory or review existing content before merging an update. It stages outside the resource directory and installs the complete directory. It never invokes a server command. After installation, `ce reload all` rebuilds models and textures using the server's existing delivery settings; `ce reload config` alone does not rebuild the pack.

### Animated furniture

```json
{
  "namespace": "my_pack",
  "id": "dragon_statue",
  "pack": "my_engine_furniture",
  "renderer": "modelengine",
  "engine_model": "dragon",
  "furniture": true,
  "hitbox": {"width": 2, "height": 3}
}
```

`renderer: "bettermodel"` is also supported. These create references to **existing** engine models, not embedded creatures. The inventory icon uses the base material. Install/export the model through its engine first; the manifest reports that dependency. Runtime playback, AI, skills and engine availability are not certified by generating this configuration.

### Keep CE as the pack sender

```json
{
  "existing_folders": ["MythicMobs/generation/resource_pack"],
  "existing_zips": [],
  "add_folders": ["ModelEngine/resource pack"]
}
```

Pass this to `mc_craftengine_pack_plan`. It preserves and deduplicates existing entries. Paths are relative to the server's `plugins` directory and are not read or verified by the Web plugin. Merge a generated folder or its ZIP once, not both; inspect collisions with packs already merged. No automatic Beta configuration edit is performed.

## Acceptance and boundaries

On 2026-09-09, an isolated copy using Beta's Paper 26.2-121 and CraftEngine 26.8.2 loaded the generated item/furniture definition, ran `ce reload all`, and completed generation, validation and compression. The final ZIP contains the expected `assets/mcp_ce/models/item/test_cube.json`, `assets/mcp_ce/items/test_cube.json` and `assets/mcp_ce/textures/item/test_cube.png`. The test server exited normally. External hosting/upload was disabled in the isolated test only.

Live Web MCP calls returned 211 tools and Alpha 8, exported the manifest and produced the merge plan while retaining the active model UUID. Unit coverage includes loss detection, engine renderer references, additive merge plans, installer traversal/collision rejection and exact installed file bytes. A graphical Minecraft client, live Beta upload and external-engine furniture rendering are separate acceptance steps and are not claimed here.

## References

- [CE model and blueprint configuration](https://xiao-momi.github.io/craft-engine-wiki/configuration/item/models/model/)
- [Furniture variants and external engines](https://xiao-momi.github.io/craft-engine-wiki/configuration/furniture/variants/)
- [Resource-pack conflict handling](https://xiao-momi.github.io/craft-engine-wiki/reference/file_conflict/)
- [Reload commands](https://xiao-momi.github.io/craft-engine-wiki/getting_start/)
