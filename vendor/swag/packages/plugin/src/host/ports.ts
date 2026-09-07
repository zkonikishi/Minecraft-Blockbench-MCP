import type { CapabilityId } from "@blockbench-mcp/shared";

/** Narrow ports — domain code depends on these, not raw globals. */

export interface BbElementRef {
  uuid: string;
  name: string;
}

export interface UndoPort {
  run: <T>(
    aspects: Record<string, unknown>,
    label: string,
    fn: (track: UndoTrack) => T,
  ) => T;
}

export interface UndoTrack {
  /** Register newly created outliner elements for finishEdit aspects. */
  addElements: (els: BbElementRef[]) => void;
  /** Register textures created in this edit. */
  addTextures: (texs: BbElementRef[]) => void;
  /** Register animations created or replacing prior clips. */
  addAnimations: (animations: BbElementRef[]) => void;
}

export interface TextureHandle extends BbElementRef {
  width: number;
  height: number;
  edit: (
    paint: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
    editName: string,
  ) => void;
  applyToCube: (cubeUuid: string, faces?: true | string[]) => void;
  /** PNG data URL, optionally downscaled to maxEdge. */
  toDataURL: (maxEdge?: number) => string;
}

export interface TexturePort {
  find: (ref: string) => TextureHandle | undefined;
  defaultOrFirst: () => TextureHandle | undefined;
  ensure: (opts: {
    name: string;
    width: number;
    height: number;
    fill: string;
    undo?: boolean;
  }) => TextureHandle;
  list: () => TextureHandle[];
}

export interface CanvasPort {
  updateElements: (
    elements: BbElementRef[],
    aspects?: { geometry?: boolean; uv?: boolean; faces?: boolean },
  ) => void;
  updateAll: () => void;
}

export interface FormatPort {
  currentId: () => string | null;
  createProject: (opts: {
    format: string;
    uv_mode?: "box" | "face";
    geometry_name?: string;
    name?: string;
    texture_width?: number;
    texture_height?: number;
  }) => { format: string; name?: string };
  hasGeckoLib: () => boolean;
}

export interface PreviewPort {
  capture: (
    view: string,
    size: number,
  ) => Promise<{ dataUrl: string; width: number; height: number }>;
}

export interface BbHost {
  undo: UndoPort;
  textures: TexturePort;
  canvas: CanvasPort;
  formats: FormatPort;
  preview: PreviewPort;
  probeCapabilities: () => CapabilityId[];
}
