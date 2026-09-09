# Alpha 6 — 2026-09-09

- Add `mc_import_bbmodel`: parsed JSON through the native project codec into a new tab, retaining existing projects. Textures must be embedded PNGs; external texture paths are ignored.
- Reconnect after unexpected bridge loss with bounded backoff; manual disconnect and policy rejection do not retry.
- Raise bridge response capacity from 16 MiB to 128 MiB for large animated model exports.
- Preserve explicit null (disabled) faces through cube creation and UV updates.
- Fit screenshots to rendered animated cube positions; exclude hidden geometry and collapsed zero-scale parts.
- Require boolean `animation.override` for ModelEngine/both audits. Missing or invalid values return `ANIMATION_OVERRIDE` and `ok:false`; the audit does not change the model. BetterModel-only audits are exempt.
- Include the local Web host bootstrap for plugin persistence after reload. The local supervisor remains installation-specific; it is not an OS startup service.

Validation: typecheck, 39 regression tests and build passed. Live authenticated SDK initialize/list/status returned version `0.1.0-alpha.6`, Web mode and 207 tools after plugin replacement and relay restart. Existing editor projects were retained. Prior BetterModel 3.4.1 / ModelEngine R4.1.1 server acceptance remains documented separately; this release does not claim a fresh graphical Minecraft acceptance run.

Upgrade both the Blockbench plugin and relay source, then restart the relay. The release ZIP includes plugin, relay, package lock, documentation and licenses; install pinned dependencies with `npm ci`. Existing credentials can be reused. No dependency versions or vendored upstream revisions changed in this release.
