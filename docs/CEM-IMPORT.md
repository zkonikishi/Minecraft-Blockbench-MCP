# Alpha 7: native CEM/JEM import

`mc_import_cem({model: <parsed JEM JSON>, name?: "file_stem"})` creates a new OptiFine entity project through Blockbench's native codec. Existing tabs remain open. The result identifies the new and previous project and reports element/group/texture counts.

All `texture` properties are removed from a cloned input, including nested textures. External JPM `model` references are rejected: inline the geometry first. `baseId`, singular `submodel`, sprites and `_is_jpm` are unsupported and rejected. No supplied filesystem path is passed to the codec; no new script execution capability is exposed. The importer validates dimensions and hierarchy limits before creating a project. On codec failure, focus returns to the old project and partial imports remain available for inspection.

This is native geometry/UV conversion, not a CEM animation translator or a guarantee of OptiFine runtime equivalence. Add embedded textures separately. Export with `mc_export_bbmodel({target:"both",allow_errors:true})` for diagnostic conversion: a textureless OptiFine project is not an engine-ready creature. The exported format remains `optifine_entity`; perform deliberate target conversion and audit downstream. Native codec conventions and limitations apply.

Validation on Blockbench 5.1.6: 40 tests, typecheck and build passed. Live authenticated SDK returned 208 Web tools / Alpha 7. A supplied zombie JEM imported as 7 cubes and 7 groups with 64x64 resolution, zero textures, and exported successfully as bbmodel. Root and part texture paths were removed. Previous project retained; migration candidates were not changed.

Upgrade plugin and relay together. Dependencies and vendored sources are unchanged from Alpha 6.
