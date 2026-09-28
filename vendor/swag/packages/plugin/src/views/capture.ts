import {
  captureViewsDefaults,
  type CaptureViewsParams,
  type ViewPreset,
} from "@blockbench-mcp/shared";
import { requireProject } from "../bb/elements.js";
import { getHost } from "../host/live.js";

export async function captureViews(params: CaptureViewsParams = {}): Promise<{
  views: Array<{
    view: ViewPreset;
    visible_face: ViewPreset | null;
    width: number;
    height: number;
    bytes: number;
    mime: string;
    data_url: string;
  }>;
}> {
  requireProject();
  const host = getHost();
  const views = (params.views ?? [
    ...captureViewsDefaults.views,
  ]) as ViewPreset[];
  const maxEdge = params.max_edge ?? captureViewsDefaults.max_edge;
  const format = params.format ?? captureViewsDefaults.format;
  const quality = (params.quality ?? captureViewsDefaults.quality) / 100;
  const out: Array<{
    view: ViewPreset;
    visible_face: ViewPreset | null;
    width: number;
    height: number;
    bytes: number;
    mime: string;
    data_url: string;
  }> = [];

  for (const view of views) {
    const raw = await host.preview.capture(view, maxEdge);
    const compressed = await compress(raw, format, quality, maxEdge);
    const mime = compressed.dataUrl.startsWith("data:image/jpeg")
      ? "image/jpeg"
      : "image/png";
    const b64 = compressed.dataUrl.split(",")[1] ?? "";
    out.push({
      view,
      visible_face: view === "iso" ? null : view,
      width: compressed.width,
      height: compressed.height,
      bytes: Math.floor((b64.length * 3) / 4),
      mime,
      data_url: compressed.dataUrl,
    });
  }
  return { views: out };
}

function compress(
  source: { dataUrl: string; width: number; height: number },
  format: "jpeg" | "png",
  quality: number,
  maxEdge: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (format === "png" && source.dataUrl.startsWith("data:image/png")) {
    return Promise.resolve(source);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const width = img.naturalWidth || source.width;
      const height = img.naturalHeight || source.height;
      const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(source);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({
        dataUrl:
          format === "jpeg"
            ? canvas.toDataURL("image/jpeg", quality)
            : canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => resolve(source);
    img.src = source.dataUrl;
  });
}
