# Runtime acceptance — 2026-09-08

## 1.0.0-rc.1 Web acceptance — 2026-09-28

The Web gate that was previously recorded as blocked — connection, reconnect, visual
capture and the full editing flow — was accepted end to end on the rc.1 build.

| Item | Evidence |
| --- | --- |
| Editor | Blockbench **5.2.1 Web**, served from `https://web.blockbench.net` (HTTPS, `isSecureContext === true`) |
| Bridge | `ws://127.0.0.1:39800/bridge` opened in **7 ms**. A loopback host is a potentially trustworthy origin per the Secure Contexts specification (`127.0.0.0/8`, `::1/128`, `localhost`), so an HTTPS page may open it without a mixed-content block |
| Connection | `mc_status` → `mode: web`, `version: 1.0.0-rc.1`, **254** tools (`tools/list` = 256) |
| Reconnect | After the relay was stopped and restarted on the same port, the plugin re-established the bridge **by itself in about 2 seconds**, with no editor-side action |
| Visual | `craft_capture_views` returned `image/png`, 25,260 bytes, written to the test output directory |
| Full authoring flow | `scripts/live-workflow.mjs --confirm-disposable`: **44/44 calls passed, exit code 0** — project creation, creature scaffold, animation sets, texture and UV packing, keyframes and mirroring, animated preview, reparenting with undo/redo, hitboxes, control nodes, script keyframes, collections, engine variant export and a captured preview |

The harness is `scripts/web-acceptance.mjs` (requires `npm i playwright-core` and an
installed Chromium-based browser). It drives a headless browser, installs the built
plugin, restarts the relay mid-run to exercise reconnect, and then runs the live
workflow. It needs no editor host of its own: the official Web editor is used, and the
plugin is injected into the running page.

This acceptance ran in a headless browser rather than a human-driven session. It does
not claim graphical fidelity of the rendered viewport, Desktop/Electron behaviour, or
any game-side engine execution.

## 1.0.0-rc.1 Desktop acceptance — 2026-09-28

The installed desktop application was accepted on the same rc.1 build, using an isolated
`--userData` profile so the real editor's settings and models were never touched.

| Item | Evidence |
| --- | --- |
| Application | Installed **Blockbench 5.1.6 Desktop** (Electron 40.10.6, Node 24.15.0); the CDP target reported `isApp: true` |
| Bridge origin | The WebSocket handshake sent `Origin: file://`, matching the Alpha 4 acceptance item for the installed application |
| Connection | The editor showed "Minecraft Blockbench MCP connected"; `mc_status` reported the desktop mode with **269** tools (267 desktop default plus 2 relay-side YSM tools) |
| Undo recovery | The `studio_undo` / `studio_redo` assertions inside `live-workflow.mjs` passed: world transforms survive reparenting and revert, and script keyframes and collections roll back and reapply |
| Full authoring flow | The same run passed **44/44 calls with exit code 0** |
| Runtime health | **0** uncaught exceptions; the 4 console events were version banners and an update notice |

Reproduce with an isolated profile and the repository harness:

```powershell
# An Electron binary that inherits ELECTRON_RUN_AS_NODE=1 runs as plain Node and exits at
# once; clear it before launching the editor.
Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& 'C:\Path\To\Blockbench.exe' --userData D:\temp\bb-profile --remote-debugging-port=39803
$env:BLOCKBENCH_TEST_DIR = '<repo>/.test-output'
$env:MINECRAFT_BLOCKBENCH_PLUGIN_FILE = '<repo>/dist/minecraft_blockbench_mcp.js'
node scripts/desktop-acceptance.mjs --confirm-isolated-desktop
```

This ran against a headless-driven desktop window. It does not claim graphical fidelity
of the viewport or any game-side engine execution.

## 1.0.0-rc.1 engine acceptance — 2026-09-28

The three engine flows were accepted against an **isolated Paper server** assembled from
copies of the production artefacts. The live server, its plugins and the editor profiles
were never modified.

| Item | Evidence |
| --- | --- |
| Server | **Paper 26.3 build 49**, JDK 25.0.4.1, a fresh flat world, loopback-only RCON for control |
| Engines | **ModelEngine R4.2.0**, **CraftEngine 26.9.2-SNAPSHOT**, **BetterModel 3.5.0** (official paper build; the downloaded jar's SHA-256 matches the digest GitHub publishes) |
| Exported by | The MCP, against a real connected Blockbench Web editor: `mc_export_engine_variants` produced the BetterModel and ModelEngine `.bbmodel` files (16 elements, 17 groups, 6 animations, embedded PNG); `mc_craftengine_export` produced the CraftEngine pack manifest |
| ModelEngine | `[ModelEngine] [A] Importing mcp_acceptance.bbmodel.` → `Resource pack zipped.` → `Generator Profiled:` |
| BetterModel | `plugins/BetterModel/build.zip` (2,157,380 bytes, 5,912 entries) contains **13** `assets/bettermodel/items/c/mcp_acceptance_<bone>.json` entries covering body, head, jaw, both wings and all four legs |
| CraftEngine | Startup logged `已加载的包：blockbench_mcp。默认命名空间：mcp_ce`; `ce reload all` completed **generate → validate → zip → upload**; the resulting `generated/resource_pack.zip` (2,572,112 bytes, 6,591 entries) contains `assets/mcp_ce/items/acceptance_cube.json`, `assets/mcp_ce/models/item/acceptance_cube.json` and `assets/mcp_ce/textures/item/acceptance_cube.png` |
| Errors | none during engine loading or resource-pack generation |

Reproduction notes:

- `ce reload all` **does** work from the console; only the bare `/ce` command opens a GUI
  and therefore requires a player sender.
- Launching Java from PowerShell fails while `http_proxy`/`https_proxy`/`no_proxy` exist
  alongside their uppercase forms: the child environment block cannot be built. Remove the
  duplicates first.
- Reuse the production `libraries`, `versions` and `cache` directories in the isolated copy
  so Paper does not re-download them; do not copy the world.

In-game rendering with a graphical client remains unverified and is not claimed here.

## Alpha 5 follow-up

### Accepted Beta server baseline

The deployment target is the user's existing Beta server: **Paper 26.2 build 121 + ModelEngine R4.1.1**. The isolated acceptance run uses byte-identical copies of both artifacts, not an inferred Dev release. No additional Dev artifact is required for this target.

On build 121, model import, resource-pack generation and 16 item_display spawn packets passed. The eye-height warning is absent, client error count is zero, and the isolated server exited normally with code 0. The live Web MCP was separately verified as Alpha 5 with 206 tools. This validates the editor/server integration; it does not claim a graphical Minecraft screenshot or the full Beta plugin composition.

Artifact SHA-256:

- Paper: `0de30efb024bc8b83c9c7d507d11802897ad8056b6110ec09fe1a91d126ccb54`
- ModelEngine: `5764f1aaf4e1a1908f51b12cb84a4999f6c637dd11b744cf9b318da19be0f03a`

Real import exposed a zero-eye-height defect in generated primary hitboxes. Alpha 5 sets a positive scaled scaffold pivot, accepts an explicit `eye_height` for primary box conversion, and warns about nonpositive ModelEngine primary pivots. Cube dimensions are preserved.

33 regression tests (the Alpha 5 follow-up run recorded here; the row below is a different, earlier checkpoint, and the current suite is 85 tests) and the complete 44-call Web workflow passed. The newly exported fixture was imported again into the same isolated Paper 26.2 / ModelEngine R4.1.1 server: the eye-height warning disappeared, the pack was generated, the native client received 16 item_display entities with no client error events, and the server stopped with exit code 0. The offline skin lookup and OSHI warnings remain unrelated environment findings.

The existing JAR's plugin.yml reports R4.1.1; its manifest does not identify a separate Dev build. The Beta artifact identity above is the acceptance target. Earlier searches for another Dev artifact are superseded by that explicit target clarification. Graphical client testing remains a distinct, unclaimed validation surface.

## Alpha 4 baseline

The installed Blockbench 5.1.6 desktop application sends `Origin: file://` for its WebSocket bridge. Alpha 3 rejected that origin before authentication. Alpha 4 accepts this exact local-file origin while retaining loopback Host checks, token authentication and rejection of untrusted HTTPS origins. Updating only the editor plugin does not fix an old running relay: restart the relay after updating its source.

## Verified

| Surface | Result |
| --- | --- |
| Installed Blockbench 5.1.6 / Electron 40.10.6 | Real MCP initialize, tools/list (218 default tools), read calls and 44 authoring calls passed |
| Desktop authoring | Geometry, UV, transforms, Undo/Redo, mirror animation, instructions, IK authoring, collections, engine variant exports and captured preview passed |
| Web Blockbench 5.1.6 | Alpha 3's same authoring implementation passed 44 calls, 206 tools; Alpha 4 changes the relay origin allowance and version metadata |
| Paper 26.2 build 92 + ModelEngine R4.1.1 | Exported workflow fixture imported; resource pack generated; summon emitted 16 item_display entities to a native 26.2 protocol client |
| Paper 26.2 build 92 + BetterModel 3.4.1 | Exported workflow fixture imported; resource pack generated; spawn/walk test emitted 40 item_display entities and entity updates |
| Protocol client | Native Mineflayer 26.2 login, no protocol error events in either engine run |
| Resource packs | BetterModel: 5,604 JSON files and 307 PNG entries; ModelEngine: 46 JSON files and 2 PNG entries. Every JSON entry parses |
| Regression | 32 tests (2026-09-08 Alpha 3/4 checkpoint record, a different run from the 33-test Alpha 5 follow-up above; the current suite is 85), including real SDK transport and authenticated desktop-origin regression, passed |

Each engine ran separately on loopback port 29566 in a fresh test directory. Both servers stopped normally with exit code 0. No production plugins, worlds or port 25565 were changed. Third-party commercial jars and generated Minecraft assets are not distributed in this repository.

## Limits and observed warnings

This proves authoring, engine import, pack structure and delivery of display-entity packets. A headless protocol client cannot certify pixels rendered by Minecraft, GPU/shader behavior, every special bone behavior or the meaning of every animation keyframe. Static audit still returns `runtimeVerified: false` for arbitrary user models.

The available ModelEngine jar identifies itself as **R4.1.1**, not an identified Dev build. Its result cannot certify a different or future Dev artifact. BetterModel was downloaded from the official 3.4.1 GitHub release.

ModelEngine warned that the test fixture's eye height is below zero. It also attempted skin lookup for the offline test account and reported `Skin URL is null`; this did not prevent model display packets. The Windows performance-counter warning came from Paper/OSHI. These warnings were retained, not classified as a clean full-game acceptance.

## Reproduce desktop acceptance

Launch the installed application with an isolated `--userData` directory and `--remote-debugging-port=39803`. Set `BLOCKBENCH_TEST_DIR` and `MINECRAFT_BLOCKBENCH_PLUGIN_FILE` to absolute output/plugin paths, then run:

```sh
node scripts/desktop-acceptance.mjs --confirm-isolated-desktop
```

This uses the installed Electron application, temporarily starts an authenticated relay on 39802, installs the plugin in the test profile and creates a disposable model. Port 39802 is also the loopback singleton port owned by `supervisor.mjs` (see [local Web lifecycle](LOCAL-WEB-LIFECYCLE.md)), so that supervisor must be stopped before this run; the Web host bootstrap uses 39801 instead. This run does not drive an existing user project. The report is `desktop.json`; model exports and preview are under `workflow-live/`. Close the isolated application when finished. Port 39803 is for local test instrumentation only.
