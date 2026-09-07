import type { UndoPort, UndoTrack, BbElementRef } from "./ports.js";
import { CommandError } from "../errors.js";

type UndoApi = {
  initEdit: (aspects: Record<string, unknown>) => void;
  finishEdit: (label: string, aspects?: Record<string, unknown>) => void;
  cancelEdit: (revert?: boolean) => void;
};

function undoApi(): UndoApi {
  const u = (globalThis as unknown as { Undo?: UndoApi }).Undo;
  if (!u?.initEdit || !u.finishEdit) {
    throw new CommandError("E_BLOCKBENCH_ERROR", "Undo API unavailable");
  }
  return {
    initEdit: u.initEdit.bind(u),
    finishEdit: u.finishEdit.bind(u),
    cancelEdit:
      typeof u.cancelEdit === "function"
        ? u.cancelEdit.bind(u)
        : () => {
            /* older builds */
          },
  };
}

/**
 * BB 5.1-correct undo: cancelEdit on failure; finishEdit includes created elements.
 */
export function createUndoPort(): UndoPort {
  return {
    run<T>(
      aspects: Record<string, unknown>,
      label: string,
      fn: (track: UndoTrack) => T,
    ): T {
      const Undo = undoApi();
      const createdEls: BbElementRef[] = [];
      const createdTex: BbElementRef[] = [];
      const createdAnimations: BbElementRef[] = [];
      const liveEls: unknown[] = [];
      const liveTex: unknown[] = [];
      const liveAnimations: unknown[] = [];
      // Avoid empty `elements: []` — BB 5.1 can throw getUndoCopy on bad aspect entries.
      const initAspects = { ...aspects };
      // Commands operate on host-port wrappers, while Blockbench's Undo API must
      // receive the corresponding native instances.  Passing wrappers works for
      // most geometry paths but BB 5.1 calls Texture#getUndoCopy during initEdit.
      // Normalize both initial and finish aspects so bitmap edits are undoable.
      if (Array.isArray(initAspects.elements)) {
        initAspects.elements = resolveUndoElements(
          initAspects.elements as unknown[],
        );
      }
      if (Array.isArray(initAspects.textures)) {
        initAspects.textures = resolveUndoTextures(
          initAspects.textures as unknown[],
        );
      }
      if (
        Array.isArray(initAspects.elements) &&
        (initAspects.elements as unknown[]).length === 0
      ) {
        delete initAspects.elements;
      }
      if (
        Array.isArray(initAspects.textures) &&
        (initAspects.textures as unknown[]).length === 0
      ) {
        delete initAspects.textures;
      }
      const initialGroups = resolveUndoGroups([
        ...(Array.isArray(aspects.groups) ? aspects.groups : []),
        ...(Array.isArray(aspects.elements) ? aspects.elements : []),
      ]);
      if (initialGroups.length) initAspects.groups = initialGroups;
      Undo.initEdit(initAspects);
      try {
        const track: UndoTrack = {
          addElements: (els) => {
            createdEls.push(...els);
            for (const e of els) {
              if (
                e &&
                typeof e === "object" &&
                "uuid" in e &&
                "getUndoCopy" in (e as object)
              ) {
                liveEls.push(e);
              }
            }
          },
          addTextures: (texs) => {
            createdTex.push(...texs);
            for (const t of texs) {
              if (
                t &&
                typeof t === "object" &&
                "uuid" in t &&
                "getUndoCopy" in (t as object)
              ) {
                liveTex.push(t);
              }
            }
          },
          addAnimations: (animations) => {
            createdAnimations.push(...animations);
            for (const animation of animations) {
              if (
                animation &&
                typeof animation === "object" &&
                "uuid" in animation
              ) {
                liveAnimations.push(animation);
              }
            }
          },
        };
        const result = fn(track);
        const finish: Record<string, unknown> = { ...initAspects };
        const els = resolveUndoElements([
          ...(Array.isArray(initAspects.elements) ? initAspects.elements : []),
          ...liveEls, ...createdEls,
        ]);
        const groups = resolveUndoGroups([...initialGroups, ...createdEls]);
        if (groups.length) finish.groups = groups;
        const texs = resolveUndoTextures([
          ...(Array.isArray(initAspects.textures) ? initAspects.textures : []),
          ...liveTex, ...createdTex,
        ]);
        const animations = liveAnimations.length
          ? liveAnimations
          : resolveLiveAnimations(createdAnimations);
        if (els.length) finish.elements = els;
        else delete finish.elements;
        if (texs.length) finish.textures = texs;
        else delete finish.textures;
        if (animations.length) finish.animations = animations;
        else if (
          Array.isArray(finish.animations) &&
          finish.animations.length === 0
        ) {
          delete finish.animations;
        }
        Undo.finishEdit(label, finish);
        return result;
      } catch (err) {
        try {
          Undo.cancelEdit(true);
        } catch {
          /* ignore */
        }
        throw err;
      }
    },
  };
}

function resolveLive(refs: BbElementRef[]): unknown[] {
  const Cube = (
    globalThis as unknown as { Cube?: { all: Array<{ uuid: string }> } }
  ).Cube;
  const Group = (
    globalThis as unknown as { Group?: { all: Array<{ uuid: string }> } }
  ).Group;
  const out: unknown[] = [];
  for (const r of refs) {
    const hit =
      Cube?.all.find((c) => c.uuid === r.uuid) ??
      Group?.all.find((g) => g.uuid === r.uuid);
    if (hit) out.push(hit);
  }
  return out;
}

function resolveUndoElements(values: unknown[]): unknown[] {
  const native = values.filter(hasUndoCopy);
  const refs = values.filter(isElementRef) as BbElementRef[];
  return [...native, ...resolveLive(refs)]
    .filter(hasUndoCopy)
    .filter((value) => !resolveUndoGroups([value]).length)
    .filter(uniqueIdentity);
}

function resolveUndoTextures(values: unknown[]): unknown[] {
  const native = values.filter(hasUndoCopy);
  const refs = values.filter(isElementRef) as BbElementRef[];
  return [...native, ...resolveLiveTextures(refs)].filter(uniqueIdentity);
}

function hasUndoCopy(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "getUndoCopy" in (value as object) &&
    typeof (value as { getUndoCopy?: unknown }).getUndoCopy === "function",
  );
}

function isElementRef(value: unknown): value is BbElementRef {
  return Boolean(value && typeof value === "object" && "uuid" in value);
}

function uniqueIdentity(
  value: unknown,
  index: number,
  values: unknown[],
): boolean {
  return values.indexOf(value) === index;
}

function resolveLiveTextures(refs: BbElementRef[]): unknown[] {
  const Texture = (
    globalThis as unknown as { Texture?: { all: Array<{ uuid: string }> } }
  ).Texture;
  return refs
    .map((r) => Texture?.all.find((t) => t.uuid === r.uuid))
    .filter(Boolean) as unknown[];
}

function resolveLiveAnimations(refs: BbElementRef[]): unknown[] {
  const Animation = (
    globalThis as unknown as {
      Animation?: { all: Array<{ uuid?: string; name: string }> };
    }
  ).Animation;
  return refs
    .map((ref) =>
      Animation?.all.find(
        (animation) =>
          animation.uuid === ref.uuid || animation.name === ref.name,
      ),
    )
    .filter(Boolean) as unknown[];
}

function resolveUndoGroups(values: unknown[]): unknown[] {
  const groups = (globalThis as unknown as {
    Group?: { all: Array<{ uuid: string }> };
  }).Group?.all ?? [];
  return values.filter(isElementRef)
    .map((value) => groups.find((group) => group.uuid === value.uuid))
    .filter(Boolean).filter(uniqueIdentity);
}
