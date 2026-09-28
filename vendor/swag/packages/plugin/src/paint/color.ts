/** Shared color helpers for paint/shade (no Blockbench deps). */

export function clamp8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function parseHex(color: string): [number, number, number] {
  const s = color.trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!m) return [154, 154, 154];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Multiply RGB by factor; keep as #rrggbb. */
export function shadeHex(color: string, factor: number): string {
  const [r, g, b] = parseHex(color);
  const rr = clamp8(r * factor);
  const gg = clamp8(g * factor);
  const bb = clamp8(b * factor);
  return `#${((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1)}`;
}

export function regionColorFor(
  name: string,
  regions: Array<{ match: string; color: string }> | undefined,
  base: string,
): string {
  if (!regions?.length) return base;
  for (const rule of regions) {
    try {
      if (new RegExp(rule.match, "i").test(name)) return rule.color;
    } catch {
      /* ignore bad regex */
    }
  }
  return base;
}

/** Soft 3×3 box blur blended by amt (0..1). */
export function blurRect(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  amt: number,
): void {
  if (rw < 2 || rh < 2 || amt <= 0) return;
  const src = ctx.getImageData(rx, ry, rw, rh);
  const s = src.data;
  const out = ctx.createImageData(rw, rh);
  const d = out.data;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      let R = 0;
      let G = 0;
      let B = 0;
      let A = 0;
      let N = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= rw || yy >= rh) continue;
          const i = (yy * rw + xx) * 4;
          R += s[i];
          G += s[i + 1];
          B += s[i + 2];
          A += s[i + 3];
          N++;
        }
      }
      const o = (y * rw + x) * 4;
      d[o] = clamp8(s[o] * (1 - amt) + (R / N) * amt);
      d[o + 1] = clamp8(s[o + 1] * (1 - amt) + (G / N) * amt);
      d[o + 2] = clamp8(s[o + 2] * (1 - amt) + (B / N) * amt);
      d[o + 3] = clamp8(s[o + 3] * (1 - amt) + (A / N) * amt);
    }
  }
  ctx.putImageData(out, rx, ry);
}
