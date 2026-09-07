# Architecture

AI client → authenticated loopback Streamable HTTP MCP → Node relay → authenticated WebSocket → one Blockbench plugin → shared tool registry → original provider handlers.

The desktop and Web variants share the same bundle. No three-server process chain is required. Node-specific file tools are omitted from the Web catalogue. Advanced script/UI/plugin administration tools require a local opt-in. The relay binds IPv4 loopback, validates Host/Origin and bearer authentication, limits outstanding calls, rejects a second editor and validates catalogue/result shapes.

## Source integration

- `src/vendor-runtime.mjs` registers all three selected provider inventories.
- `src/jason-factory.ts` adapts Jason's factory while retaining full Zod parsing.
- `scripts/bundle-options.mjs` applies explicit build transforms: Swag RPC exports and Generic format support; Jason JSON import compatibility; sosadly direct command extraction/client replacement.
- `src/registry.ts` serializes reads and writes across providers. Each queued call captures the active project and checks it before running.
- `src/engine-audit.ts` reads exported project data; it is neither engine emulation nor resource-pack generation.
- `upstream-lock.json` records exact original source bytes. `vendor/` is a selected source snapshot, not a complete clone. Optional upstream Hytale, server UI and original bridge transports are excluded from runtime.

Imported original guides are attribution/reference material. Their names, setup and scope are upstream-specific; use the root README and live prefixed schemas for this integration.

## Lifecycle limits

Disconnect cancels queued operations but cannot undo or cancel arbitrary already-running upstream JavaScript. Reconnect waits for the prior registry to drain within the same loaded plugin. A client timeout reports uncertain completion. Do not automatically retry a mutation after timeout. Native Undo behavior varies by provider; the shared lane prevents MCP calls from overlapping their edits but is not a universal transaction/rollback system.

The project checks detect manual switching before and after execution. They cannot prevent a user switching tabs midway through an upstream asynchronous handler. Avoid interacting with project tabs while a mutation is running. Uninstall the old plugin before upgrading; re-importing the same file without unloading can create duplicate actions in Blockbench.

Tools are listed from the currently connected editor. Connect Blockbench first, then discover tools. This Alpha does not push tool-list change notifications; clients must refresh after reconnect or capability changes. MCP cancellation cannot abort arbitrary editor JavaScript. The relay is local-only and not designed as a multi-user remote gateway.

The ordinary tools edit models and can replace or remove content. The advanced toggle only gates general script/UI/plugin administration, not all destructive editing. Save your working project and review AI edits through the editor's normal workflow.

## Verification

`npm test` bundles the actual adapter imports and exercises collision-free inventories, provider validation/read calls, queue/project-change behavior, engine rules, upstream hashes and real MCP SDK HTTP/WebSocket communication with a mock editor. `npm run test:upstream` runs 69 selected original shared/host/startup tests with output-path adapters.

`npm run test:live -- --confirm-disposable` creates a fresh project in a connected editor, invokes all three provider families, authors texture/UV/keyframes, obtains a PNG view and verifies embedded bitmap/keyframe data in exported `.bbmodel`. It writes a catalogue, full call evidence, preview and model to the test output directory. This creates a test asset, not a finished creature or game-runtime certification.

Build output contains the plugin, GPL license, third-party notices, dependency license inventory and SHA-256. The esbuild direct-eval warning originates in an advanced upstream UI tool; that tool is disabled by default. No upstream script is represented as a hardened sandbox.
