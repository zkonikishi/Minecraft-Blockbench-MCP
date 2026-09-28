/** Access Blockbench globals without colliding with DOM lib names. */

export function bbPlugin(): {
  register: (id: string, options: Record<string, unknown>) => unknown;
} {
  return (globalThis as unknown as { Plugin: { register: (id: string, options: Record<string, unknown>) => unknown } }).Plugin;
}

export function bbAnimation():
  | {
      all: Array<{ name: string; length?: number; loop?: string }>;
    }
  | undefined {
  return (globalThis as unknown as { Animation?: { all: Array<{ name: string }> } }).Animation;
}

export function bbBlockbench(): {
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
} {
  return (
    globalThis as unknown as {
      Blockbench: {
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
      };
    }
  ).Blockbench;
}
