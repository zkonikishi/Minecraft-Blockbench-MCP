import { requireProject } from "./elements.js";

function parentUuid(
  parent: Group | "root" | string | undefined,
): string | null {
  if (!parent || parent === "root") return null;
  return typeof parent === "string" ? parent : parent.uuid;
}

function textureRef(value: unknown): string | null {
  if (value === null || value === undefined || value === false) return null;
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "object") {
    const record = value as { uuid?: unknown; name?: unknown };
    if (typeof record.uuid === "string") return record.uuid;
    if (typeof record.name === "string") return record.name;
  }
  return "assigned";
}

export function listFormats(): Array<{
  id: string;
  name: string;
  box_uv: boolean | null;
}> {
  const formats = (
    globalThis as unknown as {
      Formats?: Record<
        string,
        { id?: string; name?: string; box_uv?: boolean }
      >;
    }
  ).Formats;
  if (!formats) return [];
  return Object.entries(formats)
    .map(([key, value]) => ({
      id: value.id ?? key,
      name: value.name ?? value.id ?? key,
      box_uv: typeof value.box_uv === "boolean" ? value.box_uv : null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getElements(opts: { refs?: string[] }): {
  groups: Array<Record<string, unknown>>;
  cubes: Array<Record<string, unknown>>;
} {
  requireProject();
  const wanted = opts.refs?.length ? new Set(opts.refs) : null;
  const includes = (element: { uuid: string; name: string }) =>
    !wanted || wanted.has(element.uuid) || wanted.has(element.name);
  return {
    groups: Group.all.filter(includes).map((group) => ({
      uuid: group.uuid,
      name: group.name,
      parent: parentUuid(group.parent),
      origin: [...group.origin],
      rotation: [...group.rotation],
      visibility:
        (group as unknown as { visibility?: boolean }).visibility !== false,
      children: (group.children ?? []).map((child) => child.uuid),
    })),
    cubes: Cube.all.filter(includes).map((cube) => ({
      uuid: cube.uuid,
      name: cube.name,
      parent: parentUuid(cube.parent),
      from: [...cube.from],
      to: [...cube.to],
      origin: [...cube.origin],
      rotation: [...cube.rotation],
      inflate: cube.inflate ?? 0,
      visibility:
        (cube as unknown as { visibility?: boolean }).visibility !== false,
      box_uv: cube.box_uv ?? false,
      uv_offset: cube.uv_offset ? [...cube.uv_offset] : null,
      mirror_uv: cube.mirror_uv ?? false,
      faces: Object.fromEntries(
        Object.entries(cube.faces ?? {}).map(([name, face]) => [
          name,
          {
            uv: face.uv ? [...face.uv] : null,
            rotation: (face as unknown as { rotation?: number }).rotation ?? 0,
            texture: textureRef(face.texture),
          },
        ]),
      ),
    })),
  };
}

export function listTextures(): Array<{
  uuid: string;
  name: string;
  width: number;
  height: number;
}> {
  requireProject();
  return Texture.all.map((texture) => ({
    uuid: texture.uuid,
    name: texture.name,
    width: texture.width,
    height: texture.height,
  }));
}

export function listAnimations(): Array<{
  name: string;
  length: number;
  loop: string;
  bones: number;
  keyframes: number;
}> {
  requireProject();
  const api = (
    globalThis as unknown as {
      Animation?: {
        all?: Array<{
          name: string;
          length?: number;
          loop?: string;
          animators?: Record<
            string,
            {
              rotations?: unknown[];
              position?: unknown[];
              scale?: unknown[];
            }
          >;
        }>;
      };
    }
  ).Animation;
  return (api?.all ?? []).map((animation) => {
    const animators = Object.values(animation.animators ?? {});
    return {
      name: animation.name,
      length: animation.length ?? 0,
      loop: animation.loop ?? "once",
      bones: animators.length,
      keyframes: animators.reduce(
        (sum, animator) =>
          sum +
          (animator.rotations?.length ?? 0) +
          (animator.position?.length ?? 0) +
          (animator.scale?.length ?? 0),
        0,
      ),
    };
  });
}
