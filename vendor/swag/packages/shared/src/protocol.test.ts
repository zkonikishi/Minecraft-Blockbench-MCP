import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_NAMES,
  COMMAND_SPECS,
  DEFAULTS,
  applyGeometryBatchParamsSchema,
  captureViewsDefaults,
  captureViewsParamsSchema,
  captureViewMetaSchema,
  checkModelParamsSchema,
  createLimbParamsSchema,
  isCommandName,
  makeError,
  mutationResultSchema,
  paintPixelBatchParamsSchema,
  packBoxUvParamsSchema,
  getUvLayoutParamsSchema,
  getUvMapParamsSchema,
  resizeTextureParamsSchema,
  paintFaceGridParamsSchema,
  getFaceGridParamsSchema,
  editTexturePixelsParamsSchema,
  replaceTextureColorParamsSchema,
  copyFacePixelsParamsSchema,
  analyzeTexturePaletteParamsSchema,
  getTextureRegionParamsSchema,
  importTexturePngParamsSchema,
  exportTexturePngParamsSchema,
  getTextureRevisionParamsSchema,
  floodFillTextureParamsSchema,
  transformTextureRegionParamsSchema,
  auditTextureQualityParamsSchema,
  setFaceUvParamsSchema,
  setProjectMetaParamsSchema,
  updateElementsParamsSchema,
  transformElementsParamsSchema,
  arrayCubesParamsSchema,
  measureModelParamsSchema,
  auditSymmetryParamsSchema,
  radialArrayCubesParamsSchema,
  duplicateHierarchyParamsSchema,
  transformUvIslandsParamsSchema,
  auditMaterialSetParamsSchema,
  ensureMaterialSetParamsSchema,
  inspectAnimationParamsSchema,
  transformAnimationKeysParamsSchema,
  analyzeViewSilhouetteParamsSchema,
  upsertAnimationParamsSchema,
  resolveGuide,
  scaffoldBipedParamsSchema,
} from "./index.js";

const MAX_LINES = 500;
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) collectTsFiles(p, out);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

describe("command registry", () => {
  it("exposes intent surface including scaffold_biped", () => {
    for (const name of [
      "scaffold_biped",
      "create_limb",
      "apply_geometry_batch",
      "check_model",
      "capture_views",
      "get_guide",
    ] as const) {
      assert.equal(isCommandName(name), true);
      assert.ok(COMMAND_SPECS[name].description.length > 0);
    }
    assert.ok(COMMAND_NAMES.length >= 12);
  });

  it("rejects kitchen-sink UI escapes", () => {
    for (const name of ["trigger_action", "risky_eval", "emulate_clicks"]) {
      assert.equal(isCommandName(name), false);
    }
  });
});

describe("guides", () => {
  it("returns modeling playbook by default", () => {
    const g = resolveGuide();
    assert.equal(g.topic, "modeling");
    assert.match(g.text, /pivot/i);
    assert.match(g.text, /scaffold_biped/);
    assert.match(g.text, /Mandatory workflow/i);
  });
});

describe("capture_views contract", () => {
  it("defaults keep screenshots compact", () => {
    assert.equal(captureViewsDefaults.max_edge, 256);
    assert.equal(DEFAULTS.screenshotMaxEdge, 256);
  });

  it("rejects unknown keys", () => {
    assert.throws(() =>
      captureViewsParamsSchema.parse({ views: ["iso"], extra: true }),
    );
  });

  it("describes which model face an orthographic camera sees", () => {
    captureViewMetaSchema.parse({
      view: "north",
      visible_face: "north",
      width: 128,
      height: 128,
      bytes: 32,
      mime: "image/png",
    });
  });
});

describe("model audit contract", () => {
  it("allows explicit intentional UV sharing without globally hiding overlaps", () => {
    checkModelParamsSchema.parse({
      allowed_uv_overlaps: [
        {
          a: { cube: "arm_left", face: "north" },
          b: { cube: "arm_right", face: "north" },
        },
      ],
    });
  });
});

describe("pixel brush batch contract", () => {
  it("accepts bounded face-local brush paths", () => {
    const value = paintPixelBatchParamsSchema.parse({
      strokes: [
        {
          cube: "head",
          face: "north",
          color: "#ffffff",
          points: [
            { x: 1, y: 1 },
            { x: 6, y: 3 },
          ],
          size: 2,
          shape: "square",
        },
      ],
    });
    assert.equal(value.strokes.length, 1);
  });

  it("rejects fractional pixels and oversized brushes", () => {
    assert.throws(() =>
      paintPixelBatchParamsSchema.parse({
        strokes: [
          {
            cube: "head",
            face: "north",
            color: "#fff",
            points: [{ x: 0.5, y: 1 }],
          },
        ],
      }),
    );
    assert.throws(() =>
      paintPixelBatchParamsSchema.parse({
        strokes: [
          {
            cube: "head",
            face: "north",
            color: "#fff",
            points: [{ x: 1, y: 1 }],
            size: 33,
          },
        ],
      }),
    );
  });
});

describe("UV atlas contracts", () => {
  it("accepts bounded packing, inspection, preview, and synchronized resize", () => {
    packBoxUvParamsSchema.parse({
      cubes: ["head"],
      preserve_others: true,
      power_of_two: true,
      max_size: 1024,
    });
    getUvLayoutParamsSchema.parse({ cubes: ["head"], include_overlaps: true });
    getUvMapParamsSchema.parse({ max_edge: 512, labels: true });
    resizeTextureParamsSchema.parse({
      width: 128,
      height: 64,
      rescale_uvs: true,
    });
  });

  it("rejects unsafe atlas limits and unknown options", () => {
    assert.throws(() => packBoxUvParamsSchema.parse({ max_size: 8192 }));
    assert.throws(() => getUvMapParamsSchema.parse({ max_edge: 2048 }));
    assert.throws(() =>
      resizeTextureParamsSchema.parse({ width: 0, height: 64 }),
    );
    assert.throws(() => getUvLayoutParamsSchema.parse({ arbitrary: true }));
  });
});

describe("precision texture contracts", () => {
  it("supports exact grids, RGBA edits, transforms, palette analysis, and zoom", () => {
    paintFaceGridParamsSchema.parse({
      faces: [{ cube: "head", face: "north", rows: ["ab", "ba"] }],
      palette: { a: "#ff000080", b: null },
    });
    getFaceGridParamsSchema.parse({ cube: "head", face: "north" });
    editTexturePixelsParamsSchema.parse({
      face: { cube: "head", face: "north" },
      pixels: [{ x: 0, y: 0, color: null }],
    });
    replaceTextureColorParamsSchema.parse({
      from: "#ff0000",
      to: "#00ff00",
      tolerance: 4,
    });
    copyFacePixelsParamsSchema.parse({
      source: { cube: "arm_left", face: "north" },
      target: { cube: "arm_right", face: "north" },
      flip_x: true,
      rotation: "0",
    });
    analyzeTexturePaletteParamsSchema.parse({ max_colors: 16 });
    getTextureRegionParamsSchema.parse({
      rect: [0, 0, 8, 8],
      scale: 16,
      grid: true,
    });
  });

  it("keeps PNG IO scoped and rejects ambiguous previews", () => {
    importTexturePngParamsSchema.parse({ path: "C:\\safe\\skin.png" });
    exportTexturePngParamsSchema.parse({
      path: "C:\\safe\\skin.png",
      overwrite: true,
    });
    assert.throws(() =>
      importTexturePngParamsSchema.parse({ path: "skin.jpg" }),
    );
    assert.throws(() =>
      getTextureRegionParamsSchema.parse({
        face: { cube: "head", face: "north" },
        rect: [0, 0, 8, 8],
      }),
    );
  });
});

describe("safe iterative texture contracts", () => {
  it("supports revision guards, bounded fills, transforms, and quality gates", () => {
    getTextureRevisionParamsSchema.parse({ texture: "skin" });
    floodFillTextureParamsSchema.parse({
      texture: "skin",
      expected_revision: "fnv1a32:12345678",
      face: { cube: "head", face: "north" },
      x: 1,
      y: 1,
      color: "rgba(0,0,0,.5)",
      tolerance: 8,
      max_pixels: 64,
    });
    transformTextureRegionParamsSchema.parse({
      rect: [0, 0, 8, 8],
      operation: "rotate_90",
    });
    auditTextureQualityParamsSchema.parse({
      palette_limit: 8,
      min_base_ratio: 0.6,
      glass: true,
    });
  });

  it("rejects ambiguous transforms and unbounded fill sizes", () => {
    assert.throws(() =>
      transformTextureRegionParamsSchema.parse({ operation: "flip_x" }),
    );
    assert.throws(() =>
      transformTextureRegionParamsSchema.parse({
        face: { cube: "head", face: "north" },
        rect: [0, 0, 8, 8],
        operation: "flip_x",
      }),
    );
    assert.throws(() =>
      floodFillTextureParamsSchema.parse({
        x: 0,
        y: 0,
        color: null,
        max_pixels: 100000,
      }),
    );
  });
});

describe("geometry schemas", () => {
  it("batch requires ops", () => {
    assert.throws(() => applyGeometryBatchParamsSchema.parse({}));
    applyGeometryBatchParamsSchema.parse({
      create_cubes: [{ name: "body", from: [0, 0, 0], to: [8, 8, 8] }],
    });
  });

  it("limb + biped parse", () => {
    createLimbParamsSchema.parse({
      name: "leg_fl",
      pivot: [2, 12, 0],
      size: [4, 12, 4],
      mirror: "x",
    });
    scaffoldBipedParamsSchema.parse({ scale: 1, texture_size: 64 });
  });
});

describe("management schemas", () => {
  it("supports exact read-modify-write geometry and UV payloads", () => {
    updateElementsParamsSchema.parse({
      updates: [
        {
          ref: "head",
          from: [-4, 24, -4],
          to: [4, 32, 4],
          parent: "body",
          visibility: true,
        },
      ],
    });
    setFaceUvParamsSchema.parse({
      entries: [
        { cube: "head", face: "north", uv: [8, 8, 16, 16], rotation: 90 },
      ],
    });
  });

  it("rejects empty metadata changes and invalid UV rotations", () => {
    assert.throws(() => setProjectMetaParamsSchema.parse({}));
    assert.throws(() =>
      setFaceUvParamsSchema.parse({
        entries: [
          { cube: "head", face: "north", uv: [0, 0, 8, 8], rotation: 45 },
        ],
      }),
    );
  });
});

describe("iterative modeling schemas", () => {
  it("supports relative transforms, arrays, measurement, symmetry, and UV policy", () => {
    transformElementsParamsSchema.parse({
      refs: ["arm_left", "arm_right"],
      translate: [0, 1, 0],
      scale: [1, 1.1, 1],
      pivot: [0, 12, 0],
      rotate: [0, 0, 5],
      uv_policy: "auto",
    });
    arrayCubesParamsSchema.parse({
      sources: ["tooth"],
      count: 8,
      offset: [1, 0, 0],
      name_pattern: "{name}_{index}",
      uv_policy: "share",
    });
    measureModelParamsSchema.parse({ refs: ["body"] });
    auditSymmetryParamsSchema.parse({
      pairs: [{ left: "arm_left", right: "arm_right" }],
      axis: "x",
      pivot: 0,
      tolerance: 0.01,
    });
    updateElementsParamsSchema.parse({
      updates: [{ ref: "head", to: [4, 32, 4] }],
      uv_policy: "preserve",
    });
  });

  it("rejects no-op transforms and unsafe array sizes", () => {
    assert.throws(() =>
      transformElementsParamsSchema.parse({ refs: ["head"] }),
    );
    assert.throws(() =>
      arrayCubesParamsSchema.parse({
        sources: ["tooth"],
        count: 129,
        offset: [1, 0, 0],
      }),
    );
  });

  it("supports bounded radial arrays, hierarchy copies, and UV island transforms", () => {
    radialArrayCubesParamsSchema.parse({
      sources: ["spoke"],
      count: 12,
      axis: "y",
      pivot: [0, 8, 0],
      rotate_cubes: true,
      uv_policy: "share",
    });
    duplicateHierarchyParamsSchema.parse({
      root: "arm_left",
      name_suffix: "_variant",
      translate: [8, 0, 0],
      uv_policy: "auto",
    });
    transformUvIslandsParamsSchema.parse({
      faces: [{ cube: "head", face: "north" }],
      translate: [8, 0],
      rotate: "90",
    });
  });

  it("rejects unbounded advanced geometry and no-op UV transforms", () => {
    assert.throws(() =>
      radialArrayCubesParamsSchema.parse({
        sources: ["spoke"],
        count: 129,
        pivot: [0, 0, 0],
      }),
    );
    assert.throws(() =>
      transformUvIslandsParamsSchema.parse({
        faces: [{ cube: "head", face: "north" }],
      }),
    );
  });
});

describe("animation schema", () => {
  it("supports scale and interpolation controls", () => {
    upsertAnimationParamsSchema.parse({
      name: "animation.test.idle",
      length: 1,
      bones: {
        body: {
          scale: [
            { time: 0, value: [1, 1, 1], interpolation: "step" },
            { time: 1, value: [1, 1.05, 1], interpolation: "catmullrom" },
          ],
        },
      },
    });
  });

  it("supports exact animation inspection and bounded key transforms", () => {
    inspectAnimationParamsSchema.parse({ name: "animation.test.idle" });
    transformAnimationKeysParamsSchema.parse({
      name: "animation.test.idle",
      bones: ["arm_left", "arm_right"],
      time_scale: 1.25,
      mirror_axis: "x",
    });
    assert.throws(() =>
      transformAnimationKeysParamsSchema.parse({ name: "animation.test.idle" }),
    );
  });
});

describe("visual and material QA schemas", () => {
  it("supports silhouette metrics and multi-channel material audits", () => {
    analyzeViewSilhouetteParamsSchema.parse({
      views: ["iso", "north"],
      max_edge: 128,
      alpha_threshold: 8,
    });
    auditMaterialSetParamsSchema.parse({
      channels: {
        base: "creature_base",
        emissive: "creature_emissive",
        normal: "creature_normal",
      },
      require_power_of_two: true,
      naming_prefix: "creature_",
    });
    ensureMaterialSetParamsSchema.parse({
      prefix: "creature",
      width: 64,
      height: 64,
      channels: ["base", "emissive", "normal", "specular"],
    });
  });
});

describe("mutation result", () => {
  it("typed failure", () => {
    const err = mutationResultSchema.parse({
      ok: false,
      ...makeError("E_PARTIAL_FORBIDDEN", "Batch aborted"),
    });
    assert.equal(err.ok, false);
  });
});

describe("architecture guard", () => {
  it("no source file exceeds 500 lines", () => {
    const files = collectTsFiles(join(ROOT, "packages"));
    assert.ok(files.length > 5, "expected package sources");
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
      if (lines > MAX_LINES) offenders.push(`${relative(ROOT, file)}:${lines}`);
    }
    assert.deepEqual(offenders, []);
  });
});
