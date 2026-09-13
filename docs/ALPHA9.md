# Alpha 9 — upstream refresh

- Jason: `b187b4b056f0efafcc573335400ecbb21ad26ecc` (v1.7.0).
- sosadly: `09ea5c6e8ffed8c5cc1b68b72f86abfe300dd592`.
- SwagRee unchanged: `b99e581d48f997d3763e827aef34eede0456574b`.

Display transforms, procedural wing generation and refreshed rig/animation helpers
are available through the existing prefixes. Keyframe writes now use per-axis
values (including nonuniform scale and zero edits); texture creation preserves
render settings; asynchronous codecs are awaited before export serialization.
`anim_export_model` requires desktop filesystem access and is excluded from Web.

The original upstream bridge is not started. Our authenticated loopback relay,
Web origins, single-editor ownership and serial execution queue remain in use.
The extracted animation state has its own namespace. Script execution checks the
integration's Advanced setting at execution time and is hidden by default.
`anim_request_review`, `anim_wait_review`, and `anim_ask_user` require the original
Copilot panel, which is not bundled; they are excluded on both platforms. Use the
MCP client conversation for review. Imported upstream guides can mention these
excluded tools; the actual tool catalogue takes precedence.

Validation: typecheck/build and 51 integration tests passed, including new async
export, independent scale-axis/zero-edit and Advanced-setting regressions.
48 original sosadly bridge/generator tests passed, including wing continuity,
mirroring and fly-cycle behaviour. The existing SwagRee test suite also passed.
These automated tests do not establish graphical Minecraft client rendering or
new BetterModel, ModelEngine or CraftEngine server acceptance.

Live Web acceptance: Alpha 9 returned 235 default tools; all three display tools
and `anim_add_wing` were present, restricted tools were absent, and
`mc_get_workflow` executed successfully. No model was open or changed.
