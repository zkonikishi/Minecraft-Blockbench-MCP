import { requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { withUndo } from "../bb/undo.js";

type Key = {
  time: number;
  data_points?: Array<{ x: number; y: number; z: number }>;
};
type Animator = {
  group?: { uuid?: string; name?: string };
  rotations?: Key[];
  position?: Key[];
  scale?: Key[];
};
type AnimationRecord = {
  name: string;
  length: number;
  loop: string;
  animators?: Record<string, Animator>;
};

function findAnimation(name: string): AnimationRecord {
  requireProject();
  const all = (
    globalThis as unknown as { Animation?: { all?: AnimationRecord[] } }
  ).Animation?.all;
  const animation = all?.find((item) => item.name === name);
  if (!animation)
    throw new CommandError("E_NOT_FOUND", `Animation not found: ${name}`);
  return animation;
}

function channels(animator: Animator): Array<[string, Key[]]> {
  return ["rotations", "position", "scale"].flatMap((name) => {
    const keys = animator[name as keyof Animator];
    return Array.isArray(keys) ? [[name, keys] as [string, Key[]]] : [];
  });
}

export function inspectAnimation(opts: { name: string }) {
  const animation = findAnimation(opts.name);
  const bones = Object.entries(animation.animators ?? {}).map(
    ([id, animator]) => ({
      id,
      name: animator.group?.name ?? id,
      channels: Object.fromEntries(
        channels(animator).map(([name, keys]) => [
          name,
          keys.map((key) => ({
            time: key.time,
            value: key.data_points?.[0]
              ? [
                  key.data_points[0].x,
                  key.data_points[0].y,
                  key.data_points[0].z,
                ]
              : null,
          })),
        ]),
      ),
    }),
  );
  return {
    name: animation.name,
    length: animation.length,
    loop: animation.loop,
    bones,
    summary: {
      bones: bones.length,
      keyframes: bones.reduce(
        (sum, bone) =>
          sum +
          Object.values(bone.channels).reduce((n, keys) => n + keys.length, 0),
        0,
      ),
    },
  };
}

export function transformAnimationKeys(opts: {
  name: string;
  bones?: string[];
  time_scale?: number;
  time_offset?: number;
  value_scale?: [number, number, number];
  mirror_axis?: "x" | "y" | "z";
}) {
  const animation = findAnimation(opts.name);
  const wanted = opts.bones ? new Set(opts.bones) : null;
  const selected = Object.entries(animation.animators ?? {}).filter(
    ([id, animator]) =>
      !wanted ||
      wanted.has(id) ||
      (animator.group?.name && wanted.has(animator.group.name)),
  );
  if (wanted && !selected.length)
    throw new CommandError("E_NOT_FOUND", "No requested animation bones found");
  return withUndo(
    { animations: [animation], keyframes: [] },
    `transform_animation_keys ${opts.name}`,
    () => {
      let updated = 0;
      const axis =
        opts.mirror_axis === "x" ? 0 : opts.mirror_axis === "y" ? 1 : 2;
      for (const [, animator] of selected) {
        for (const [channel, keys] of channels(animator)) {
          for (const key of keys) {
            key.time = Math.max(
              0,
              key.time * (opts.time_scale ?? 1) + (opts.time_offset ?? 0),
            );
            for (const point of key.data_points ?? []) {
              const values = [point.x, point.y, point.z];
              for (let i = 0; i < 3; i += 1)
                values[i] *= opts.value_scale?.[i] ?? 1;
              if (opts.mirror_axis) {
                if (channel === "position") values[axis] *= -1;
                else if (channel === "rotations")
                  for (let i = 0; i < 3; i += 1)
                    if (i !== axis) values[i] *= -1;
              }
              [point.x, point.y, point.z] = values;
            }
            updated += 1;
          }
        }
      }
      if (opts.time_scale !== undefined || opts.time_offset !== undefined) {
        animation.length = Math.max(
          0.001,
          animation.length * (opts.time_scale ?? 1) + (opts.time_offset ?? 0),
        );
      }
      return {
        ok: true as const,
        undo_label: `transform_animation_keys ${opts.name}`,
        updated_keyframes: updated,
      };
    },
  );
}
