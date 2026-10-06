# Third-party notices

Minecraft Blockbench MCP is distributed under **GPL-3.0-only**. This repository
integrates code from four independently maintained upstream projects. It is not
an official Blockbench, BetterModel or ModelEngine project.

## Jason J. Gardner — blockbench-mcp-plugin

- Source: https://github.com/jasonjgardner/blockbench-mcp-plugin
- Commit: `6295e20af26ec0f67bc81a5e95dac98db85a1801` (v1.9.3)
- License: GPL-3.0-only. In this repository the original license is at
  `vendor/jason/LICENSE`, with the project's own copy at root `LICENSE`; the
  distributed package carries the GPL text as `LICENSE` (`dist/LICENSE` in a
  build tree) and does not include `vendor/`.
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
  loaded. Source files are byte-identical to the pinned upstream commit.
- MIT permission notice. Upstream declares MIT only in its `package.json` and
  `README.md`; the pinned tree has no standalone license file and names no copyright
  holder, so no copyright line can be reconstructed from the sources and none is
  invented here. The permission notice is reproduced in full:

  ```text
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
  ```

## sosadly — blockbench-mcp

- Source: https://github.com/sosadly/blockbench-mcp
- Commit: `028cdd76589de2e2cea51bfd79495b50a3c7d1d2`
- License: MIT, Copyright (c) 2026 sosadly. Full notice in this repository at
  `vendor/sosadly/LICENSE`; the distributed package carries it as
  `dist/licenses/sosadly-MIT.txt`.
- Contribution: animation/model/texture operations, editor commands, screenshot
  content and modeling guides.
- Integration: extract the command implementation (including helpers) at build
  time; replace HTTP forwarding with direct in-process calls. Do not start its
  original bridge or register its original plugin.

`upstream-lock.json` records 428 selected upstream files and the pinned sources'
own SHA-256 hashes across the three source trees above: jason 324, SwagRee 96 and
sosadly 8. Vendored sources are stored with LF line endings and are byte-identical
to those commits. The fourth source, OpenYSM/YSMParser, is pinned by
`vendor/ysmparser/provenance.json` instead of the lock. Local integration changes
live in `src/` and `scripts/`. Build output (`dist/`) must be distributed with
this notice: it carries `LICENSE`, `THIRD_PARTY_NOTICES.md`, `SHA256SUMS` and
`licenses/` (98 dependency license files, including `sosadly-MIT.txt` and
`dependency-inventory.json`). The public repository supplies the matching source.

Runtime/build dependencies retain their own licenses: Zod (MIT), zod-to-json-schema
(ISC), Ajv (MIT), ws (MIT), MCP TypeScript SDK (MIT), esbuild (MIT), TypeScript
(Apache-2.0), and Node.js type definitions (MIT). See installed dependency license
files and `package-lock.json` for the exact dependency graph.

## OpenYSM — YSMParser (optional offline recovery runtime)

- Source: https://github.com/OpenYSM/YSMParser/tree/v0.3.6
- Commit: `86c48922ecae79c4e9d16bffed1e8becbe849f98`.
- License: MIT; preserved in `vendor/ysmparser/LICENSE.txt`.
- The unmodified Web WASM release is pinned in `vendor/ysmparser/provenance.json` by
  the SHA-256 of the release archive and of each extracted file. It runs locally in a
  worker with a virtual filesystem, without Minecraft, the Mod, or a browser/editor.
- Recovery does not grant permission to redistribute third-party model assets.

## Modifications to vendored sources

The files under `vendor/` are byte-identical to the pinned upstream commits and are
not edited on disk. The distributed bundle is nonetheless a **modified build**, which
GPL-3.0 section 5(a) requires be stated. `scripts/bundle-options.mjs` rewrites these
vendored sources in memory while bundling:

- `vendor/jason/lib/constants.ts` — removes the `assert { type: "json" }` import attribute.
- `vendor/swag/packages/plugin/src/host/preview-port.ts` — substitutes the local
  posed-bounds framing helper for the upstream cube-corner one.
- `vendor/swag/packages/shared/src/protocol-base.ts` — adds `"free"` to the project
  format enum.
- `vendor/swag/packages/plugin/src/mcp/rpc.ts` — re-exports `listTools` / `callTool`.
- `vendor/sosadly/plugin/blockbench_mcp.js` — extracts the command implementation,
  replaces its HTTP client with an in-process one, renames its global state key and
  marks disabled faces.

`scripts/bundle-options.mjs` holds the exact edits and fails the build if a pinned
anchor changes. The generated bundle banner repeats this notice.

## Vendored agent skill directories

The `vendor/jason` tree also carries 92 third-party agent skill files under
`.agents/skills/`. They are reference documentation for coding agents, they are not
loaded at build or run time, and they are redistributed verbatim as part of the
pinned snapshot. The upstream repository publishes them under its own
GPL-3.0-only `LICENSE` (`vendor/jason/LICENSE`, identical in text to the root
`LICENSE`) at commit `6295e20af26ec0f67bc81a5e95dac98db85a1801`. Their individual
licensors are:

- `mcp-builder/` (10 files) and `skill-creator/` (7 files): Apache-2.0, each with its
  own `LICENSE.txt`.
- `vue-best-practices/` (18 files): declares `license: MIT` with author `hyf0`. The
  MIT permission text is not included upstream.
- `zod/` (45 files), `blockbench-plugins/` (6 files), `typescript-expert/` (5 files)
  and `bun-development/` (1 file): no license field and no license file — 57 files.

The last group carries no permission statement of its own, and no separate
permission was obtained from its authors, who are not identified in the files. Those
files are redistributed only as part of the upstream GPL-3.0-only snapshot. Treat
this as a residual, documented risk rather than a resolved grant.
