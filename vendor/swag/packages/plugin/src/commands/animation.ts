import { withUndo } from "../bb/undo.js";
import { requireGroup, requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";

type Vec3 = [number, number, number];
type AnimationKey = {
  time: number;
  value: Vec3;
  interpolation?: "linear" | "catmullrom" | "step";
};
type BoneKeys = {
  rotation?: AnimationKey[];
  position?: AnimationKey[];
  scale?: AnimationKey[];
};

type AnimatorApi = {
  addKeyframe: (data: {
    channel: "rotation" | "position" | "scale";
    time: number;
    interpolation: "linear" | "catmullrom" | "step";
    data_points: Array<{ x: number; y: number; z: number }>;
  }) => unknown;
};

type AnimationRecord = {
  uuid: string;
  name: string;
  length: number;
  loop: string;
  add?: (undo?: boolean) => AnimationRecord;
  remove?: (undo?: boolean) => void;
  setLength?: (length: number) => void;
  getBoneAnimator?: (group: Group) => AnimatorApi | undefined;
};

type AnimationCtor = {
  new (data?: Record<string, unknown>): AnimationRecord;
  all: AnimationRecord[];
};

function animationApi(): AnimationCtor {
  const api = (globalThis as unknown as { Animation?: AnimationCtor })
    .Animation;
  if (!api || !Array.isArray(api.all)) {
    throw new CommandError(
      "E_UNSUPPORTED_FORMAT",
      "Animations are not available in this format/plugin set.",
    );
  }
  return api;
}

export function upsertAnimation(opts: {
  name: string;
  length: number;
  loop?: "once" | "hold" | "loop";
  bones?: Record<string, BoneKeys>;
  replace?: boolean;
}): { ok: true; undo_label: string; name: string; keyframes: number } {
  requireProject();
  const Api = animationApi();
  const existing = Api.all.find((animation) => animation.name === opts.name);
  if (existing && opts.replace !== true) {
    throw new CommandError(
      "E_INVALID_PARAM",
      `Animation "${opts.name}" exists; pass replace:true`,
    );
  }

  const bones = Object.entries(opts.bones ?? {}).map(([ref, channels]) => ({
    group: requireGroup(ref),
    channels,
  }));
  const label = `upsert_animation ${opts.name}`;

  return withUndo(
    { animations: existing ? [existing] : [], keyframes: [] },
    label,
    (track) => {
      if (existing) {
        if (typeof existing.remove === "function") existing.remove(false);
        else Api.all.splice(Api.all.indexOf(existing), 1);
      }
      const animation = new Api({
        name: opts.name,
        length: opts.length,
        loop: opts.loop ?? "loop",
      });
      animation.add?.(false);
      track.addAnimations([animation]);
      animation.setLength?.(opts.length);

      let keyframes = 0;
      for (const { group, channels } of bones) {
        const animator = animation.getBoneAnimator?.(group);
        if (!animator) {
          throw new CommandError(
            "E_BLOCKBENCH_ERROR",
            `Cannot create animator for bone: ${group.name}`,
          );
        }
        for (const channel of ["rotation", "position", "scale"] as const) {
          for (const key of channels[channel] ?? []) {
            animator.addKeyframe({
              channel,
              time: key.time,
              interpolation: key.interpolation ?? "linear",
              data_points: [
                { x: key.value[0], y: key.value[1], z: key.value[2] },
              ],
            });
            keyframes += 1;
          }
        }
      }
      return {
        ok: true as const,
        undo_label: label,
        name: opts.name,
        keyframes,
      };
    },
  );
}
