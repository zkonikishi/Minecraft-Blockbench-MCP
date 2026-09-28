import { z } from "zod";

/** Declared plugin minimum; agents should use Blockbench ≥ this. */
export const MIN_BLOCKBENCH_VERSION = "5.1.0";

export const CAPABILITY_IDS = [
  "geometry",
  "textures",
  "screenshots",
  "animations",
  "geckolib",
  "filesystem",
  "painter",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const capabilitiesSchema = z.array(z.enum(CAPABILITY_IDS));

export function parseSemverParts(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isBlockbenchSupported(version: string): boolean {
  const [a, b, c] = parseSemverParts(version);
  const [A, B, C] = parseSemverParts(MIN_BLOCKBENCH_VERSION);
  if (a !== A) return a > A;
  if (b !== B) return b > B;
  return c >= C;
}
