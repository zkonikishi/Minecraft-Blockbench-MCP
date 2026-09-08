# Runtime acceptance — 2026-09-08

## Alpha 5 follow-up

### Accepted Beta server baseline

The deployment target is the user's existing Beta server: **Paper 26.2 build 121 + ModelEngine R4.1.1**. The isolated acceptance run uses byte-identical copies of both artifacts, not an inferred Dev release. No additional Dev artifact is required for this target.

On build 121, model import, resource-pack generation and 16 item_display spawn packets passed. The eye-height warning is absent, client error count is zero, and the isolated server exited normally with code 0. The live Web MCP was separately verified as Alpha 5 with 206 tools. This validates the editor/server integration; it does not claim a graphical Minecraft screenshot or the full Beta plugin composition.

Artifact SHA-256:

- Paper: `0de30efb024bc8b83c9c7d507d11802897ad8056b6110ec09fe1a91d126ccb54`
- ModelEngine: `5764f1aaf4e1a1908f51b12cb84a4999f6c637dd11b744cf9b318da19be0f03a`

Real import exposed a zero-eye-height defect in generated primary hitboxes. Alpha 5 sets a positive scaled scaffold pivot, accepts an explicit `eye_height` for primary box conversion, and warns about nonpositive ModelEngine primary pivots. Cube dimensions are preserved.

33 regression tests and the complete 44-call Web workflow passed. The newly exported fixture was imported again into the same isolated Paper 26.2 / ModelEngine R4.1.1 server: the eye-height warning disappeared, the pack was generated, the native client received 16 item_display entities with no client error events, and the server stopped with exit code 0. The offline skin lookup and OSHI warnings remain unrelated environment findings.

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
| Regression | 32 tests, including real SDK transport and authenticated desktop-origin regression, passed |

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

This uses the installed Electron application, temporarily starts an authenticated relay on 39802, installs the plugin in the test profile and creates a disposable model. It does not drive an existing user project. The report is `desktop.json`; model exports and preview are under `workflow-live/`. Close the isolated application when finished. Port 39803 is for local test instrumentation only.
