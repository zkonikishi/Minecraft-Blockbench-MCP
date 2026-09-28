import type { ViewPreset } from "@blockbench-mcp/shared";
import { captureViews } from "./capture.js";

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot decode captured view"));
    image.src = dataUrl;
  });
}

export async function analyzeViewSilhouette(opts: {
  views?: ViewPreset[];
  max_edge?: number;
  alpha_threshold?: number;
  luminance_threshold?: number;
}) {
  const captures = await captureViews({
    views: opts.views,
    max_edge: opts.max_edge ?? 256,
    format: "png",
  });
  const rows = [];
  for (const view of captures.views) {
    const image = await loadImage(view.data_url);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || view.width;
    canvas.height = image.naturalHeight || view.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context for silhouette analysis");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const alphaThreshold = opts.alpha_threshold ?? 8;
    const luminanceThreshold = opts.luminance_threshold ?? 245;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;
    let foreground = 0;
    for (let y = 0; y < canvas.height; y += 1)
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const alpha = pixels[offset + 3];
        const luminance =
          pixels[offset] * 0.2126 +
          pixels[offset + 1] * 0.7152 +
          pixels[offset + 2] * 0.0722;
        if (alpha <= alphaThreshold || luminance >= luminanceThreshold)
          continue;
        foreground += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    const bounds = foreground ? [minX, minY, maxX + 1, maxY + 1] : [0, 0, 0, 0];
    rows.push({
      view: view.view,
      visible_face: view.visible_face,
      width: canvas.width,
      height: canvas.height,
      bounds,
      silhouette_size: [bounds[2] - bounds[0], bounds[3] - bounds[1]],
      foreground_pixels: foreground,
      coverage: foreground / Math.max(1, canvas.width * canvas.height),
      data_url: view.data_url,
    });
  }
  return { views: rows };
}
