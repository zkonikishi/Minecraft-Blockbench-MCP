import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
  bundle: true,
  format: "iife",
  platform: "neutral",
  write: false,
  plugins: [{
    name: "mock-http-listener",
    setup(builder) {
      builder.onLoad({ filter: /[\\/]mcp[\\/]server\.ts$/ }, () => ({
        contents: "export function startMcpHttp() { return globalThis.testStartServer(); }",
        loader: "ts",
      }));
    },
  }],
});
const source = result.outputFiles[0].text;

function fixture({ autoLoad = true, blockedStorage = false, autostart = true, storedFlag = false } = {}) {
  let hooks;
  let starts = 0;
  let stops = 0;
  let nextTimer = 0;
  const timers = new Map();
  const dialogs = [];
  const storage = new Map(storedFlag ? [["blockbench_mcp_prompt_start", "1"]] : []);
  const context = {
    Plugin: { register(id, options) { hooks = options; if (autoLoad) hooks.onload(); } },
    Blockbench: { showQuickMessage() {}, showMessageBox(options, callback) { dialogs.push({ options, callback }); } },
    Settings: { add() {} },
    settings: { mcp_autostart: { value: autostart } },
    Action: class { setName() {} delete() {} },
    localStorage: {
      getItem(key) { if (blockedStorage) throw new Error("blocked"); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw new Error("blocked"); storage.set(key, value); },
      removeItem(key) { if (blockedStorage) throw new Error("blocked"); storage.delete(key); },
    },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    testStartServer() {
      starts++;
      return { port: 39741, running: () => true, stop: () => { stops++; } };
    },
    console,
  };
  runInNewContext(source, context);
  return {
    get hooks() { return hooks; }, get starts() { return starts; }, get stops() { return stops; },
    dialogs, timers, storage, context,
    flush() {
      const pending = [...timers.entries()].sort((left, right) => left[1].delay - right[1].delay);
      for (const [id, timer] of pending) { if (timers.delete(id)) timer.callback(); }
    },
  };
}

test("first file install: onload then oninstall prompts before opening net", () => {
  const app = fixture();
  app.hooks.oninstall();
  app.flush();
  assert.equal(app.dialogs.length, 1);
  assert.equal(app.starts, 0);
  app.dialogs[0].callback(0);
  assert.equal(app.starts, 1);
  assert.equal(app.storage.has("blockbench_mcp_prompt_start"), false);
});

test("install callback before onload also prompts exactly once", () => {
  const app = fixture({ autoLoad: false });
  app.hooks.oninstall(); app.hooks.onload(); app.flush();
  assert.equal(app.dialogs.length, 1); assert.equal(app.starts, 0);
});
test("blocked localStorage does not lose the in-memory install signal", () => {
  const app = fixture({ blockedStorage: true });
  app.hooks.oninstall(); app.flush();
  assert.equal(app.dialogs.length, 1); assert.equal(app.starts, 0);
});
test("Later does not fall through to an earlier automatic start timer", () => {
  const app = fixture(); app.hooks.oninstall(); app.flush();
  app.dialogs[0].callback(1); app.flush();
  assert.equal(app.starts, 0); assert.equal(app.timers.size, 0);
});
test("normal load honors auto-start and does not prompt", () => {
  const app = fixture(); app.flush();
  assert.equal(app.starts, 1); assert.equal(app.dialogs.length, 0);
});
test("disabled auto-start stays disabled on normal load", () => {
  const app = fixture({ autostart: false }); app.flush();
  assert.equal(app.starts, 0); assert.equal(app.dialogs.length, 0);
});
test("a first install still asks when auto-start is disabled", () => {
  const app = fixture({ autostart: false }); app.hooks.oninstall(); app.flush();
  assert.equal(app.dialogs.length, 1); assert.equal(app.starts, 0);
});
test("unload cancels pending startup and preserves an unshown install prompt", () => {
  const app = fixture(); app.hooks.oninstall(); app.hooks.onunload(); app.flush();
  assert.equal(app.dialogs.length, 0); assert.equal(app.starts, 0);
  assert.equal(app.storage.get("blockbench_mcp_prompt_start"), "1");
  app.hooks.onload(); app.flush(); assert.equal(app.dialogs.length, 1);
});
test("an old confirmation cannot start the server after unload and reload", () => {
  const app = fixture({ autostart: false }); app.hooks.oninstall(); app.flush();
  const oldCallback = app.dialogs[0].callback;
  app.hooks.onunload(); app.hooks.onload(); app.flush(); oldCallback(0);
  assert.equal(app.starts, 0);
});
test("persisted install prompt is consumed only when displayed", () => {
  const app = fixture({ storedFlag: true });
  assert.equal(app.storage.get("blockbench_mcp_prompt_start"), "1");
  app.flush(); assert.equal(app.dialogs.length, 1);
  assert.equal(app.storage.has("blockbench_mcp_prompt_start"), false);
});
test("repeated install callbacks replace timers rather than duplicating prompts", () => {
  const app = fixture(); app.hooks.oninstall(); app.hooks.oninstall(); app.flush();
  assert.equal(app.dialogs.length, 1); assert.equal(app.starts, 0);
});
test("start preference is read at execution time", () => {
  const app = fixture(); app.context.settings.mcp_autostart.value = false; app.flush();
  assert.equal(app.starts, 0);
});
