# Third-party notices

Minecraft Blockbench MCP is distributed under **GPL-3.0-only**. This repository
integrates code from three independently maintained upstream projects. It is not
an official Blockbench, BetterModel or ModelEngine project.

## Jason J. Gardner — blockbench-mcp-plugin

- Source: https://github.com/jasonjgardner/blockbench-mcp-plugin
- Commit: `6b069e308fdfc9b0a1c15bc924ca78150815f143`
- License: GPL-3.0-only; original license in `vendor/jason/LICENSE` and root `LICENSE`.
- Contribution: core studio modeling, mesh, paint, material, camera, UV, animation,
  history and UI tools, schema utilities and authoring skills.
- Integration: replace its registration factory with the common registry; retain
  original handlers and full Zod schema validation. Optional Hytale integration,
  original server/UI and resource/prompt transport are not loaded.

## SwagRee — BlockBenchMCP

- Source: https://github.com/SwagRee/BlockBenchMCP
- Commit: `b99e581d48f997d3763e827aef34eede0456574b`
- Declared license: MIT in upstream package.json and README. The pinned upstream
  tree contains no standalone LICENSE; no copyright date or text is attributed
  to the author beyond those declarations.
- Contribution: geometry, Minecraft authoring contracts, UV/texture/pixel tools,
  audits, animation operations, host abstractions and guides/tests.
- Integration: expose its existing call/list functions in the bundle; add Generic
  `free` to its project format enum at build time. Original networking/UI are not
  loaded. Source files remain byte-identical to the recorded snapshot.

## sosadly — blockbench-mcp

- Source: https://github.com/sosadly/blockbench-mcp
- Commit: `273607ba5421f808e68e9041f8733f4dc46e7bb9`
- License: MIT, Copyright (c) 2026 sosadly. Full notice: `vendor/sosadly/LICENSE`.
- Contribution: animation/model/texture operations, editor commands, screenshot
  content and modeling guides.
- Integration: extract the command implementation (including helpers) at build
  time; replace HTTP forwarding with direct in-process calls. Do not start its
  original bridge or register its original plugin.

All selected upstream files and their original SHA-256 hashes are recorded in
`upstream-lock.json`. Local integration changes live in `src/` and `scripts/`.
Build output must be distributed with this notice, all third-party licenses and
corresponding source. The public repository supplies the matching source.

Runtime/build dependencies retain their own licenses: Zod (MIT), zod-to-json-schema
(ISC), Ajv (MIT), ws (MIT), MCP TypeScript SDK (MIT), esbuild (MIT), TypeScript
(Apache-2.0), and Node.js type definitions (MIT). See installed dependency license
files and `package-lock.json` for the exact dependency graph.
