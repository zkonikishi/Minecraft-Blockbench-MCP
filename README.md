# Minecraft Blockbench MCP

[![Release](https://img.shields.io/github/v/release/zkonikishi/Minecraft-Blockbench-MCP?include_prereleases)](https://github.com/zkonikishi/Minecraft-Blockbench-MCP/releases)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

**English** | [简体中文](README.zh-CN.md)

**Current release: `1.0.0-rc.1` (release candidate).** Every automated gate passes:
type checking, build, 85 project regression tests, 117 upstream tests, a clean
production dependency audit, and staged-release verification. The **Web editor path is
accepted end to end** — connection, automatic reconnect, visual capture and the full
authoring workflow all pass against Blockbench 5.2.1 Web. **Desktop and engine
acceptance is still outstanding** — see [release gates](docs/RELEASE-GATES.md). A final
`1.0.0` is published only after those gates pass.

Let AI author Minecraft models, textures and skeletal animation in **Blockbench
Desktop and Web**, and export to **BetterModel, ModelEngine and CraftEngine**.

One Blockbench plugin, one local MCP service, one shared serial execution queue. The
current `Alpha` branch exposes **254 default Web editor tools** (**261** with Advanced
enabled) plus **2 offline YSM tools**, so a default Web client's `tools/list` sees
**256**. Desktop exposes **267** (**274** with Advanced) and adds file-related
capabilities. Actual availability is whatever `tools/list` returns after connecting.

## What is in this release

- **Upstream sync.** Jason `blockbench-mcp-plugin` v1.9.3, sosadly `blockbench-mcp`
  and OpenYSM/YSMParser v0.3.6 are pinned at their current commits; SwagRee is
  already at its latest. The vendored trees are byte-identical to those commits.
- **Verifiable packaging.** A staged release now carries the 98-file dependency
  license inventory, `SHA256SUMS`, the GPL text and the third-party notices, and the
  verification gate fails if any of them is missing.
- **Reproducible upstream pin.** `upstream-lock.json` records the upstream sources'
  own SHA-256 over 273 files, so the snapshot can be re-checked against upstream.
- **Single-sourced version.** The plugin, the relay and `mc_status` all derive their
  version from `package.json`.
- **Offline YSM recovery.** `mc_ysm_inspect` / `mc_ysm_recover` and a CLI recover
  `.bbmodel`, textures and bone animation from `.ysm` containers without Minecraft,
  the mod, or an editor.
- **Animation and visual review.** Read-only animation diagnostics, dry-run bone
  chain variants, playable frame atlases, and six shared visual tools (multi-view,
  framing, texture/UV, animation frames, before/after comparison).

## What you can do

| Area | Current capability |
| --- | --- |
| Creature modelling | Cube and mesh editing, multi-level bones, wings, tails, jaws, attachment points, editable skeleton drafts |
| Textures and preview | UV layout, pixel painting, multi-view screenshots, framing from the current animated pose |
| Skeletal animation | Keyframes, mirroring and phase, Molang/Bezier data, IK control points, pose preview |
| BetterModel / ModelEngine | Engine rule checks, hitbox and eye height, bone tags, per-engine `.bbmodel` export with embedded textures |
| CraftEngine | Static item and furniture blueprints, engine model references for dynamic furniture, resource-pack merge plans |
| Model import | Native `.bbmodel` JSON import; OptiFine CEM/JEM geometry and UV import that preserves the existing project |
| Connection and large files | Automatic reconnect, shared execution queue, 128 MiB bridge response limit |

Skeleton templates are a starting point; animation slots still need real keyframes.
Pathfinding, combat AI and skill logic remain the job of the game or server plugin.

## Engine support scope

| Target | What this MCP does | Runtime dependency and boundary |
| --- | --- | --- |
| BetterModel | Creature bones, animation authoring, rule checks, model export | BetterModel on the server; behaviour and skills are implemented server-side |
| ModelEngine | Creature bones, animation, hitbox, tag checks, model export | ModelEngine on the server; verify features against your target version |
| CraftEngine | Static item / furniture blueprints, dynamic furniture model references, pack merge plans | CE generates and distributes the resource pack; dynamic models depend on BetterModel / ModelEngine |
| YSM | Offline container parsing, bbmodel recovery, difference reports | Verified on one representative sample per container family; runtime semantics are bounded |
| Armourer's Workshop | Offline recovery route is registered | No converter or usable import interface yet |

## Quick start

Requires **Node.js 22+**, **Blockbench 5.1+**, and an AI client that supports
**Streamable HTTP MCP with Bearer headers**. The Web editor also needs this MCP
service running locally.

### 1. Install and start the service

```powershell
git clone --branch Alpha https://github.com/zkonikishi/Minecraft-Blockbench-MCP.git
cd Minecraft-Blockbench-MCP
npm.cmd ci --ignore-scripts
npm.cmd run build
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the generated value into `MINECRAFT_BLOCKBENCH_TOKEN` in `.env`, then start:

```powershell
npm.cmd start
```

You can also use the run ZIP from the releases page: unpack it, install dependencies,
configure `.env` and start — it already contains a compiled
`dist/minecraft_blockbench_mcp.js`. Downloading the plugin JS alone does not replace
the local service.

### 2. Connect Blockbench

1. Open **File → Plugins → Load Plugin from File** and select
   `dist/minecraft_blockbench_mcp.js`.
2. Find **Minecraft MCP token** in the settings and enter the same value as the
   server.
3. Keep the bridge URL at `ws://127.0.0.1:39800/bridge`.
4. Click **Tools → Connect Minecraft MCP**.

The Web edition uses the same file-loading path. Blockbench's plugin URL installer
does not accept plain HTTP; a file-loaded plugin is also not persisted across page
reloads. See [persistent loading and reconnect](docs/LOCAL-WEB-LIFECYCLE.md) for a
local Web host.

When upgrading, update both the plugin and the relay sources and restart the relay;
an existing token keeps working. Reconnect and refresh the client's tool list after
changing tool settings.

### 3. Configure your AI client

These are the connection details; field names differ between clients:

```json
{
  "url": "http://127.0.0.1:39800/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_RANDOM_TOKEN"
  }
}
```

Call `mc_status` after connecting to check the version, the current project and the
tool count. The service listens on the loopback interface only, so a cloud client
cannot reach `127.0.0.1` on your machine. One relay serves one editor window.

### 4. Verify it really works

Starting the MCP service, the client discovering tools, and Blockbench connecting are
three independent steps. Treat a successful `mc_status` that returns editor state as
the signal; seeing a tool list alone does not mean you can edit a model.

| Symptom | What to check |
| --- | --- |
| Client cannot reach the MCP service | The service is running, the URL and port match, and the Bearer token is correct |
| Tools list, but the editor is reported as disconnected | Load the plugin in Blockbench, check the bridge URL and token, then run Connect Minecraft MCP |
| Tools stop working after a Web page reload | Reload the plugin, or configure persistent loading as described for the local Web host |
| A second editor window fails to connect | One relay serves one editor; disconnect the first window or keep using it |
| A model operation times out | Inspect the project and the result in the editor first, and avoid duplicate imports or duplicate creation |

## Example requests

Once connected you can describe a goal directly, for example:

- "Build a quadruped for BetterModel with jaw and tail bones and idle / walk
  animations, check it, then export."
- "Check whether the current model conforms to ModelEngine, list the bone, texture
  and animation problems, fix them, and export both engine variants."
- "Export the current Java Block model as a CraftEngine static furniture content pack
  and generate the resource-pack merge plan."

These are authoring examples; results still need previewing and engine verification.
AI does not get complete motion or combat behaviour from a skeleton template alone.

## Three authoring workflows

### BetterModel / ModelEngine creatures

Call `mc_get_workflow` and `mc_engine_profile` first, then create or import a project:

1. `mc_create_project` / `mc_import_bbmodel` → modelling and texturing.
2. Author bone animation and check the motion with the preview tools.
3. `mc_audit_model` → fix the compatibility problems for the target engine.
4. `mc_export_bbmodel` / `mc_export_engine_variants` → export.

`target: "both"` applies conservative shared rules; it does not mean every engine
feature converts. ModelEngine's `animation.override` must be a boolean — validation
reports an error instead of writing a value for you. See
[compatibility](docs/COMPATIBILITY.md) and
[workflow tools](docs/WORKFLOW-TOOLS.md).

### CraftEngine items and furniture

Call `mc_craftengine_profile` to inspect the scope, then `mc_craftengine_export` to
generate the file manifest of a CE content pack:

- Static models use a Java Block/Item project, per-face UV and an embedded PNG, and
  CE blueprints generate the resource-pack model.
- Dynamic furniture references an installed BetterModel / ModelEngine model; the
  corresponding engine still owns the animation.
- `mc_craftengine_pack_plan` produces a merge plan that preserves existing entries
  and follows CE's normal pack distribution.

The release ships a content-pack installer that pre-checks and refuses to overwrite an
existing directory. The MCP never uploads a resource pack or modifies server
credentials. See [CraftEngine](docs/CRAFTENGINE.md) for full parameters, installation
and reloading.

### Importing existing models

- `mc_import_bbmodel`: pass parsed model JSON and create a project through the native
  codec; embedded PNGs are required. [Parameters and limits](docs/JSON-IMPORT.md)
- `mc_import_cem`: pass JEM JSON to restore native geometry and UV, strip texture paths
  and reject external JPM references; CEM animation expressions are not converted.
  [Parameters and limits](docs/CEM-IMPORT.md)

Tool parameters are defined by the schemas returned from `tools/list`. Avoid switching
projects while editing; after a long operation times out, inspect the editor state
before deciding whether to retry.

## Verification status

Automated, reproducible today:

| Scope | What passes |
| --- | --- |
| Project regression | `npm run check` — type checking, build and 85 tests |
| Upstream adaptation | `npm run test:upstream` — 117 tests (69 shared/host/startup plus 48 sosadly) |
| Dependency audit | `npm audit --omit=dev --audit-level=moderate` — 0 advisories |
| Release gate | `scripts/stage-release.mjs` + `scripts/verify-release.mjs` — 156 staged files, licenses and checksums asserted |
| Upstream pin | Every vendored file matches the pinned upstream commit (273 files) |
| Web editor acceptance | Blockbench 5.2.1 Web over HTTPS: connected (`mode: web`, 254 tools), auto-reconnected in ~2 s after a relay restart, `craft_capture_views` returned a PNG, and `live-workflow` passed 44/44 calls |

Historic acceptance records, listed for context:

| Scope | Completed verification |
| --- | --- |
| Alpha 8 local Web | Real SDK connection, 211 tools, CE export and merge-plan calls, active project unchanged |
| CraftEngine 26.8.2 | Content loading, resource-pack generation, verification and compression in an isolated environment on Paper 26.2-121 |
| Desktop Blockbench 5.1.6 | Real connection and 44 authoring-flow calls in an earlier version |
| BetterModel 3.4.1 / ModelEngine R4.1.1 | Model import, resource-pack generation and display-entity data verification in earlier isolated tests |

These records do not cover every tool, every model or future engine versions. **The
graphical Minecraft client result, the actual Beta upload, and external-engine
rendering of CE dynamic furniture have not been accepted in this round.** See
[runtime acceptance](docs/RUNTIME-ACCEPTANCE.md) and
[CE acceptance scope](docs/CRAFTENGINE.md#acceptance-and-boundaries).

## Development and tool sources

```powershell
npm.cmd run check
npm.cmd run test:upstream
# The following create a new project in a dedicated test editor:
npm.cmd run test:live -- --confirm-disposable
node scripts/live-workflow.mjs --confirm-disposable
# Web editor acceptance in a headless browser (one-off: npm i playwright-core):
$env:MINECRAFT_BLOCKBENCH_TOKEN = '<your relay token>'
npm.cmd run test:web
```

`BLOCKBENCH_BUILD_DIR` and `BLOCKBENCH_TEST_DIR` set the build and test output
directories. Original upstream snapshots are pinned by `upstream-lock.json`; the
adaptation code lives in `src/` and `scripts/`. See
[architecture](docs/ARCHITECTURE.md).

| Tool prefix | Source |
| --- | --- |
| `craft_*` | [SwagRee/BlockBenchMCP](https://github.com/SwagRee/BlockBenchMCP) |
| `studio_*` | [jasonjgardner/blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) |
| `anim_*` | [sosadly/blockbench-mcp](https://github.com/sosadly/blockbench-mcp) |
| `mc_*` | This project's Minecraft workflows, engine adaptation, import and export tools |

Advanced script execution, general UI control and plugin administration are off by
default and must be enabled in the local editor settings. Enabling them grants local
editor privileges, not a restricted sandbox.

## Roadmap

Offline YSM recovery shipped in this line; **Armourer's Workshop (AM/AW) is still not
implemented.** Next: broader YSM format and sample coverage, animation controllers and
complex material mapping. See [YSM scope](docs/YSM.md) and
[development roadmap](docs/ROADMAP.md).

## License

**GPL-3.0-only.** The four upstream projects' authors and licenses are preserved;
when redistributing, also provide the corresponding source, the licenses and the
[third-party notices](THIRD_PARTY_NOTICES.md). See [LICENSE](LICENSE).

This project is not an official Blockbench, BetterModel, ModelEngine or CraftEngine
product.
