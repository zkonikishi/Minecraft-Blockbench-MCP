import type { CapabilityId } from "@blockbench-mcp/shared";
import type { BbHost } from "./ports.js";
import { createUndoPort } from "./undo-port.js";
import { createTexturePort } from "./texture-port.js";
import { createCanvasPort } from "./canvas-port.js";
import { createFormatPort } from "./format-port.js";
import { requireNodeModule } from "./node-modules.js";
import { createPreviewPort } from "./preview-port.js";

function probeCapabilities(host: Omit<BbHost, "probeCapabilities">): CapabilityId[] {
  const caps: CapabilityId[] = ["geometry"];
  try {
    host.textures.list();
    caps.push("textures");
  } catch {
    /* no textures */
  }
  const g = globalThis as unknown as {
    Screencam?: { screenshotPreview?: unknown };
    Painter?: { edit?: unknown };
    require?: (m: string) => unknown;
    Blockbench?: { isApp?: boolean };
  };
  if (g.Screencam?.screenshotPreview) caps.push("screenshots");
  if (g.Painter?.edit) caps.push("painter");
  if (host.formats.hasGeckoLib()) caps.push("geckolib");
  const Anim = (globalThis as unknown as { Animation?: { all?: unknown } }).Animation;
  if (Anim?.all) caps.push("animations");
  if (g.Blockbench?.isApp) {
    try {
      requireNodeModule("fs");
      caps.push("filesystem");
    } catch {
      /* no fs */
    }
  }
  return caps;
}

let cached: BbHost | null = null;

/** Composition root for Blockbench host ports. */
export function getHost(): BbHost {
  if (cached) return cached;
  const undo = createUndoPort();
  const textures = createTexturePort();
  const canvas = createCanvasPort();
  const formats = createFormatPort();
  const preview = createPreviewPort();
  const host: BbHost = {
    undo,
    textures,
    canvas,
    formats,
    preview,
    probeCapabilities: () => probeCapabilities(host),
  };
  cached = host;
  return host;
}

export function resetHostForTests(): void {
  cached = null;
}
