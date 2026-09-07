import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const directory = mkdtempSync(join(tmpdir(), "blockbench-mcp-host-"));
const output = join(directory, "host.mjs");
await build({
  stdin: {
    contents: [
      'export * from "./host/format-port.ts";',
      'export * from "./host/undo-port.ts";',
      'export * from "./host/canvas-port.ts";',
      'export * from "./host/preview-port.ts";',
      'export * from "./host/node-modules.ts";',
      'export * from "./host/live.ts";',
      'export * from "./geometry/transform.ts";',
      'export * from "./geometry/update.ts";',
      'export * from "./geometry/spatial.ts";',
      'export * from "./commands/scope-export.ts";',
      'export { createProjectParamsSchema } from "@blockbench-mcp/shared";',
    ].join("\n"),
    resolveDir: new URL("../src", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"),
  },
  bundle: true, platform: "neutral", format: "esm", outfile: output,
});
const host = await import(pathToFileURL(output).href);
after(() => rmSync(directory, { recursive: true, force: true }));

class MockCube {
  static all = [];
  constructor(name, from = [0, 0, 0], to = [2, 2, 2]) {
    this.name = this.uuid = name;
    this.from = [...from]; this.to = [...to];
    this.origin = [0, 0, 0]; this.rotation = [0, 0, 0];
    this.inflate = 0; this.visibility = true; this.faces = {};
    MockCube.all.push(this);
  }
  getUndoCopy() { return { uuid: this.uuid }; }
}
class MockGroup {
  static all = [];
  constructor(name, origin = [0, 0, 0]) {
    this.name = this.uuid = name; this.origin = [...origin];
    this.rotation = [0, 0, 0]; this.children = []; this.visibility = true;
    MockGroup.all.push(this);
  }
  add(child) { child.parent = this; this.children.push(child); return child; }
}
let undoCalls;
let canvasCalls;
beforeEach(() => {
  MockCube.all = []; MockGroup.all = [];
  undoCalls = []; canvasCalls = [];
  Object.assign(globalThis, {
    Cube: MockCube, Group: MockGroup, Texture: { all: [] },
    Project: { name: "reference", texture_width: 256, texture_height: 256 },
    Format: { id: "bedrock" }, Formats: {},
    Undo: {
      initEdit(aspects) {
        assert.ok((aspects.elements ?? []).every((element) => typeof element.getUndoCopy === "function"));
        undoCalls.push(["init", aspects]);
      },
      finishEdit(label, aspects) { undoCalls.push(["finish", aspects]); },
      cancelEdit() { undoCalls.push(["cancel"]); },
    },
    Canvas: { updateView: (options) => canvasCalls.push(options), updateAll: () => canvasCalls.push("all") },
  });
  for (const key of ["newProject", "require", "Codecs", "Screencam", "window"]) delete globalThis[key];
  host.resetHostForTests();
});

const near = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-7, actual + " != " + expected));

test("Bedrock formats accept explicit UV and geometry identifier", () => {
  for (const format of ["bedrock", "bedrock_old"]) {
    assert.equal(host.createProjectParamsSchema.parse({ format, uv_mode: "face", geometry_name: "costume" }).format, format);
  }
  assert.throws(() => host.createProjectParamsSchema.parse({ format: "invented" }));
});
test("native newProject preserves reference and avoids the interactive wizard", () => {
  const reference = globalThis.Project;
  let wizard = false;
  globalThis.Formats.bedrock = { new: () => { wizard = true; } };
  globalThis.newProject = (format) => {
    assert.equal(format, globalThis.Formats.bedrock);
    globalThis.Project = {}; return true;
  };
  const result = host.createFormatPort().createProject({ format: "bedrock", name: "new", uv_mode: "face", geometry_name: "costume", texture_width: 128, texture_height: 64 });
  assert.equal(result.format, "bedrock"); assert.equal(wizard, false);
  assert.equal(reference.name, "reference"); assert.equal(globalThis.Project.box_uv, false);
  assert.equal(globalThis.Project.geometry_name, "costume");
  assert.equal(globalThis.Project.texture_height, 64);
});
test("unsupported formats and cancellation do not change the reference", () => {
  const reference = globalThis.Project;
  assert.throws(() => host.createFormatPort().createProject({ format: "bedrock" }));
  globalThis.Formats.bedrock = { new() {} }; globalThis.newProject = () => false;
  assert.throws(() => host.createFormatPort().createProject({ format: "bedrock" }));
  assert.equal(globalThis.Project, reference);
});
test("groups go to groups undo aspects, not element getUndoCopy", () => {
  const group = new MockGroup("Head"); const cube = group.add(new MockCube("face"));
  host.createUndoPort().run({ elements: [group, cube], outliner: true }, "edit", () => {});
  for (const [, aspects] of undoCalls) {
    assert.deepEqual(aspects.elements, [cube]); assert.deepEqual(aspects.groups, [group]);
  }
});
test("new groups and existing cubes both survive finishEdit", () => {
  const cube = new MockCube("face"); const group = new MockGroup("Head");
  host.createUndoPort().run({ elements: [cube], outliner: true }, "edit", (track) => track.addElements([group]));
  assert.deepEqual(undoCalls[1][1].elements, [cube]); assert.deepEqual(undoCalls[1][1].groups, [group]);
});
test("failed mutations roll back once", () => {
  assert.throws(() => host.createUndoPort().run({}, "edit", () => { throw new Error("fail"); }));
  assert.deepEqual(undoCalls.map(([kind]) => kind), ["init", "cancel"]);
});
test("canvas refresh includes child meshes, bones, transforms and visibility", () => {
  const group = new MockGroup("Head"); const cube = group.add(new MockCube("face"));
  host.createCanvasPort().updateElements([group]);
  assert.deepEqual(canvasCalls[0].groups, [group]); assert.deepEqual(canvasCalls[0].elements, [cube]);
  assert.equal(canvasCalls[0].element_aspects.transform, true);
  assert.equal(canvasCalls[0].element_aspects.visibility, true);
  assert.equal(canvasCalls[0].group_aspects.transform, true);
});
test("group translation moves descendants and does not double-transform selected children", () => {
  const group = new MockGroup("Head", [0, 24, 0]);
  const nested = group.add(new MockGroup("Hair", [0, 30, 0]));
  const cube = nested.add(new MockCube("face", [-4, 24, -4], [4, 32, 4]));
  const result = host.transformElements({ refs: [group.uuid, nested.uuid, cube.uuid], translate: [3, 2, 1] });
  near(cube.from, [-1, 26, -3]); near(group.origin, [3, 26, 1]); near(nested.origin, [3, 32, 1]);
  assert.equal(result.updated.length, 3); assert.equal(undoCalls[1][1].groups.length, 2);
});
test("cube rotation orbits its pivot only once", () => {
  const cube = new MockCube("cube", [2, 0, 0], [4, 2, 2]);
  host.transformElements({ refs: [cube.uuid], rotate: [0, 0, 90] });
  near(host.cubeWorldBounds(cube).min, [-2, 2, 0]);
  near(host.cubeWorldBounds(cube).max, [0, 4, 2]);
});
test("nested rotations compose and retain local child rotations", () => {
  const group = new MockGroup("Head", [0, 24, 0]); group.rotation = [20, 10, 0];
  const cube = group.add(new MockCube("face", [-4, 24, -4], [4, 32, 4])); cube.rotation = [0, 0, 15]; cube.origin = [0, 24, 0];
  const original = host.cubeWorldCorners(cube);
  host.transformElements({ refs: [group.uuid], rotate: [0, 90, 0] });
  const transformed = host.cubeWorldCorners(cube);
  original.forEach(([x, y, z], index) => near(transformed[index], [z, y, -x]));
  near(cube.rotation, [0, 0, 15]);
});
test("uniform scale includes descendant origins and inflate", () => {
  const group = new MockGroup("Head", [0, 24, 0]); const cube = group.add(new MockCube("face")); cube.inflate = 0.25;
  host.transformElements({ refs: [group.uuid], scale: [2, 2, 2] });
  near(group.origin, [0, 48, 0]); near(cube.to, [4, 4, 4]); assert.equal(cube.inflate, 0.5);
});
test("unrepresentable nonuniform scaling is rejected before undo", () => {
  const cube = new MockCube("face"); cube.rotation = [0, 0, 30];
  assert.throws(() => host.transformElements({ refs: [cube.uuid], scale: [2, 1, 1] }));
  assert.equal(undoCalls.length, 0); near(cube.to, [2, 2, 2]);
});
test("framing follows off-origin tall models and ignores hidden bones", () => {
  const visible = new MockCube("hat", [100, 24, -4], [108, 55, 4]); visible.inflate = 0.5;
  const hidden = new MockGroup("hidden"); hidden.visibility = false;
  hidden.add(new MockCube("large", [-10000, 0, 0], [10000, 1, 1]));
  const { preset, span } = host.framingPreset("north");
  near(preset.target, [104, 39.5, 0]); assert.equal(preset.projection, "orthographic");
  for (const point of host.cubeWorldCorners(visible)) {
    assert.ok(Math.hypot(...point.map((value, axis) => value - preset.target[axis])) < span / 2);
  }
});
test("capture fits orthographic zoom without moving selected camera or geometry", async () => {
  const cube = new MockCube("body", [-4, 0, -4], [4, 40, 4]); const original = [...cube.from];
  let preset; let rendered = false;
  const camera = { left: -16, right: 16, top: 16, bottom: -16, updateProjectionMatrix() {} };
  const preview = { camOrtho: camera, resize() {}, loadAnglePreset(value) { preset = value; }, render() { rendered = true; } };
  globalThis.Image = class { set src(value) { this.onload(); } };
  globalThis.Screencam = { NoAAPreview: preview, screenshotPreview(target, options, callback) {
    assert.equal(target, preview); assert.equal(rendered, true); callback("data:image/png;base64,AAAA");
  } };
  const result = await host.createPreviewPort().capture("north", 512);
  near(preset.target, [0, 20, 0]); assert.ok(camera.zoom < 1); assert.equal(result.width, 512);
  near(cube.from, original);
});
test("filesystem reports permission denial instead of bypassing it", () => {
  globalThis.require = () => { throw new Error("denied"); };
  assert.throws(() => host.requireNodeModule("fs"), /permission/);
});
test("scoped export uses native project codec with explicit overwrite", () => {
  const writes = []; const files = new Set();
  const path = { isAbsolute: (value) => value.startsWith("/"), resolve: (value) => value, relative: (root, target) => target.startsWith(root + "/") ? target.slice(root.length + 1) : "../escape" };
  globalThis.require = (name) => name === "path" ? path : {
    existsSync: (target) => files.has(target), readFileSync() {},
    writeFileSync: (target, data) => { writes.push([target, data]); files.add(target); },
  };
  globalThis.Codecs = { project: { compile: () => ({ meta: { model_format: "bedrock" }, textures: [{ source: "data:image/png;base64,AAAA" }] }) } };
  const session = { scopedDirectory: "/models" };
  const result = host.saveProject(session, { path: "/models/costume.bbmodel" });
  assert.equal(result.codec, "project"); assert.ok(result.bytes > 0);
  assert.equal(JSON.parse(writes[0][1]).meta.model_format, "bedrock");
  assert.throws(() => host.saveProject(session, { path: "/models/costume.bbmodel" }));
  assert.throws(() => host.saveProject(session, { path: "/other/costume.bbmodel" }));
  assert.throws(() => host.saveProject({ scopedDirectory: null }, { path: "/models/other.bbmodel" }));
  host.saveProject(session, { path: "/models/costume.bbmodel", overwrite: true });
  assert.equal(writes.length, 2);
});

test("legacy formats reject unsupported face UV before creating a tab", () => {
  globalThis.Formats.bedrock_old = { new() {}, box_uv: true, optional_box_uv: false };
  assert.throws(() => host.createFormatPort().createProject({ format: "bedrock_old", uv_mode: "face" }));
  assert.equal(globalThis.Project.name, "reference");
});
test("missing native creation cannot rename the active reference through a wizard", () => {
  let wizard = false;
  globalThis.Formats.bedrock = { new() { wizard = true; } };
  assert.throws(() => host.createFormatPort().createProject({ format: "bedrock", name: "new" }));
  assert.equal(wizard, false); assert.equal(globalThis.Project.name, "reference");
});
test("update_elements refreshes transforms and retains initial undo elements", () => {
  const cube = new MockCube("face");
  host.updateElements({ updates: [{ ref: cube.uuid, origin: [0, 24, 0], rotation: [10, 0, 0], visibility: false }] });
  near(cube.origin, [0, 24, 0]); near(cube.rotation, [10, 0, 0]);
  assert.equal(cube.visibility, false); assert.equal(canvasCalls[0].element_aspects.transform, true);
  assert.deepEqual(undoCalls[1][1].elements, [cube]);
});
test("module loader supports lexical plugin require without global require", async () => {
  const modulePath = join(directory, "scoped-loader.mjs");
  const filesystem = { existsSync() {} };
  globalThis.__scopedRequire = (name) => { assert.equal(name, "fs"); return filesystem; };
  await build({
    entryPoints: [new URL("../src/host/node-modules.ts", import.meta.url).pathname.replace(/^\/(\w:)/, "$1")],
    bundle: true, platform: "neutral", format: "esm", outfile: modulePath,
    banner: { js: "const require = globalThis.__scopedRequire;" },
  });
  const scoped = await import(pathToFileURL(modulePath).href);
  assert.equal(globalThis.require, undefined);
  assert.equal(scoped.requireNodeModule("fs"), filesystem);
  delete globalThis.__scopedRequire;
});
