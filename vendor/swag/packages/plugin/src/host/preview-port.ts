import type { PreviewPort } from "./ports.js";
import { CommandError } from "../errors.js";
import { boundsOfPoints, cubeWorldCorners } from "../geometry/spatial.js";

type Vector = { set: (x: number, y: number, z: number) => unknown };
type CapturePreview = {
  loadAnglePreset: (preset: Record<string, unknown>) => void;
  resize: (width: number, height: number) => void;
  render?: () => void;
  camOrtho?: {
    left: number; right: number; top: number; bottom: number;
    zoom: number; near: number; far: number;
    up?: Vector;
    updateProjectionMatrix: () => void;
  };
};

export function framingPreset(view: string): { preset: Record<string, unknown>; span: number } {
  const cubes = (globalThis as unknown as { Cube?: { all: Cube[] } }).Cube?.all ?? [];
  const visible = cubes.filter((cube) => {
    if (cube.visibility === false) return false;
    let parent = cube.parent;
    while (parent && parent !== "root" && typeof parent !== "string") {
      if (parent.visibility === false) return false;
      parent = parent.parent;
    }
    return true;
  });
  const corners = visible.flatMap(cubeWorldCorners);
  const bounds = boundsOfPoints(corners);
  const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2);
  const radius = Math.max(1, ...corners.map((point) => Math.hypot(...point.map((value, axis) => value - center[axis]))));
  const directions: Record<string, number[]> = {
    north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0],
    up: [0, 1, 0.0001], down: [0, -1, 0.0001], iso: [1, 0.8, 1],
  };
  const direction = directions[view] ?? directions.iso;
  const distance = radius * 4 + 64;
  const length = Math.hypot(...direction);
  return {
    preset: {
      projection: "orthographic",
      position: center.map((value, axis) => value + direction[axis] / length * distance),
      target: center,
    },
    span: radius * 2.3,
  };
}

export function createPreviewPort(): PreviewPort {
  return {
    capture(view, size) {
      return new Promise((resolve, reject) => {
        const screen = (globalThis as unknown as {
          Screencam?: {
            NoAAPreview?: CapturePreview;
            screenshotPreview?: (preview: unknown, opts: Record<string, unknown>, callback: (url: string) => void) => void;
          };
        }).Screencam;
        const preview = screen?.NoAAPreview;
        if (!preview || !screen?.screenshotPreview) {
          reject(new CommandError("E_BLOCKBENCH_ERROR", "Offscreen screenshot API unavailable; the user's selected camera is not modified"));
          return;
        }
        const timeout = setTimeout(() => reject(new CommandError("E_TIMEOUT", "Screenshot timed out")), 20_000);
        try {
          const frame = framingPreset(view);
          preview.resize(size, size);
          preview.loadAnglePreset(frame.preset);
          const camera = preview.camOrtho;
          if (camera) {
            camera.zoom = Math.min(camera.right - camera.left, camera.top - camera.bottom) / frame.span;
            camera.near = 0.01;
            camera.far = Math.max(1000, frame.span * 10 + 128);
            camera.updateProjectionMatrix();
          }
          preview.render?.();
          screen.screenshotPreview(preview, { width: size, height: size, crop: false }, (url) => {
            clearTimeout(timeout);
            const image = new Image();
            image.onload = () => resolve({ dataUrl: url, width: image.naturalWidth || size, height: image.naturalHeight || size });
            image.onerror = () => resolve({ dataUrl: url, width: size, height: size });
            image.src = url;
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    },
  };
}
