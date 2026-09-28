/** Minimal Blockbench globals used by the MCP plugin. */
declare const Blockbench: {
  version: string;
  isApp?: boolean;
  showQuickMessage?: (msg: string, time?: number) => void;
  showMessageBox?: (
    options: {
      title?: string;
      message: string;
      buttons?: string[];
      confirm?: number;
      cancel?: number;
    },
    callback?: (button: number) => void,
  ) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
};

declare const Plugin: {
  register: (
    id: string,
    options: Record<string, unknown>,
  ) => { id: string; delete?: () => void };
};

declare const Formats: Record<
  string,
  {
    id?: string;
    name?: string;
    new?: () => void;
    box_uv?: boolean;
  }
>;

declare const Project:
  | {
      name?: string;
      geometry_name?: string;
      texture_width?: number;
      texture_height?: number;
      box_uv?: boolean;
    }
  | undefined;

declare const Format:
  | {
      id?: string;
      name?: string;
      box_uv?: boolean;
      codec?: { compile?: () => unknown };
    }
  | undefined;

declare const Codecs: Record<string, { compile?: () => unknown }> | undefined;

declare const Undo: {
  initEdit: (aspects: Record<string, unknown>) => void;
  finishEdit: (label: string) => void;
};

declare class Group {
  uuid: string;
  name: string;
  origin: number[];
  rotation: number[];
  visibility?: boolean;
  children: Array<Group | Cube>;
  parent?: Group | "root" | string;
  constructor(data?: Record<string, unknown>);
  addTo: (parent?: Group | "root") => Group;
  init: () => Group;
  createUniqueName?: () => void;
  remove?: (undo?: boolean) => void;
  static all: Group[];
}

declare class Cube {
  uuid: string;
  name: string;
  from: number[];
  to: number[];
  origin: number[];
  rotation: number[];
  inflate: number;
  parent?: Group | "root" | string;
  faces: Record<
    string,
    { texture?: unknown; uv?: number[]; rotation?: number }
  >;
  visibility?: boolean;
  box_uv?: boolean;
  autouv?: number;
  mirror_uv?: boolean;
  uv_offset?: number[];
  constructor(data?: Record<string, unknown>);
  addTo: (parent?: Group | "root") => Cube;
  init: () => Cube;
  applyTexture: (texture: Texture, faces?: boolean | string[]) => void;
  mapAutoUV?: () => void;
  remove?: (undo?: boolean) => void;
  static all: Cube[];
}

declare class Texture {
  uuid: string;
  name: string;
  width: number;
  height: number;
  img?: HTMLImageElement;
  canvas?: HTMLCanvasElement;
  getInternalContext?: () => CanvasRenderingContext2D;
  updateContext?: () => void;
  updateChangesAfterEdit?: () => void;
  apply?: () => void;
  static all: Texture[];
  static getDefault?: () => Texture | undefined;
}

declare const TextureAnimator:
  { isPlaying?: boolean; start?: () => void } | undefined;

declare const Outliner: {
  root: Array<Group | Cube>;
  selected?: Array<Group | Cube>;
};

declare const Canvas: { updateAll?: () => void; updateView?: () => void };

declare const Preview: {
  selected?: {
    loadAnglePreset?: (preset: unknown) => void;
    camera?: unknown;
    isOrtho?: boolean;
  };
};

declare const Screencam: {
  NoAAPreview?: Preview["selected"] & {
    resize?: (w: number, h: number) => void;
    loadAnglePreset?: (preset: unknown) => void;
  };
  screenshotPreview?: (
    preview: unknown,
    options: { width: number; height: number; crop?: boolean },
    cb: (dataUrl: string) => void,
  ) => void;
};

declare const DefaultCameraPresets: Array<
  Record<string, unknown> & { id?: string }
>;

declare const Animation:
  | {
      all: Array<{
        name: string;
        length?: number;
        loop?: string;
        animators?: unknown;
      }>;
      selected?: unknown;
    }
  | undefined;

interface PluginData {
  name?: string;
  title?: string;
  author?: string;
  description?: string;
  icon?: string;
  version?: string;
  variant?: string;
  onload?: () => void;
  onunload?: () => void;
  oninstall?: () => void;
  onuninstall?: () => void;
}

declare const Settings: {
  add?: (id: string, setting: Record<string, unknown>) => void;
};

declare const settings: Record<string, { value?: unknown }>;

declare class Action {
  constructor(
    id: string,
    options: {
      name: string;
      icon?: string;
      category?: string;
      click: () => void;
    },
  );
  delete: () => void;
  setName?: (name: string) => void;
  setIcon?: (icon: string) => void;
}

declare function require(id: string): unknown;
