import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveUvModeFromHints } from "./uv-mode.js";

describe("UV mode resolution", () => {
  it("honors explicit mode over format", () => {
    assert.equal(
      resolveUvModeFromHints({
        explicit: "box",
        formatId: "java_block",
        formatBoxUv: false,
      }),
      "box",
    );
    assert.equal(
      resolveUvModeFromHints({
        explicit: "face",
        formatId: "bedrock",
        formatBoxUv: true,
      }),
      "face",
    );
  });

  it("maps java_block to per-face and bedrock-style to box", () => {
    assert.equal(resolveUvModeFromHints({ formatId: "java_block" }), "face");
    assert.equal(resolveUvModeFromHints({ formatBoxUv: false }), "face");
    assert.equal(resolveUvModeFromHints({ formatId: "bedrock" }), "box");
    assert.equal(resolveUvModeFromHints({ projectBoxUv: true }), "box");
  });

  it("uses unanimous cube flags before format id", () => {
    assert.equal(
      resolveUvModeFromHints({
        formatId: "java_block",
        cubeBoxFlags: [true, true],
      }),
      "box",
    );
    assert.equal(
      resolveUvModeFromHints({
        formatId: "bedrock",
        cubeBoxFlags: [false, false],
      }),
      "face",
    );
  });
});
