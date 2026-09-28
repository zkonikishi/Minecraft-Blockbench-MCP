import { refreshView, requireCube, requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";

type FaceName = "north" | "south" | "east" | "west" | "up" | "down";

export function transformUvIslands(opts: {
  faces: Array<{ cube: string; face: FaceName }>;
  translate?: [number, number];
  scale?: [number, number];
  pivot?: [number, number];
  rotate?: "0" | "90" | "180" | "270";
  clamp_to_texture?: boolean;
}) {
  requireProject();
  const entries = opts.faces.map((target) => {
    const cube = requireCube(target.cube);
    const face = cube.faces?.[target.face];
    if (!face?.uv)
      throw new CommandError(
        "E_INVALID_PARAM",
        `Face has no UV: ${target.cube}.${target.face}`,
      );
    return { cube, face };
  });
  const cubes = [...new Set(entries.map((entry) => entry.cube))];
  const points = entries.flatMap(({ face }) => [
    [face.uv![0], face.uv![1]] as [number, number],
    [face.uv![2], face.uv![3]] as [number, number],
  ]);
  const pivot = opts.pivot ?? [
    (Math.min(...points.map((point) => point[0])) +
      Math.max(...points.map((point) => point[0]))) /
      2,
    (Math.min(...points.map((point) => point[1])) +
      Math.max(...points.map((point) => point[1]))) /
      2,
  ];
  const translate = opts.translate ?? [0, 0];
  const scale = opts.scale ?? [1, 1];
  const quarterTurns = Number(opts.rotate ?? "0") / 90;
  const transform = (point: [number, number]): [number, number] => {
    let x = (point[0] - pivot[0]) * scale[0];
    let y = (point[1] - pivot[1]) * scale[1];
    for (let turn = 0; turn < quarterTurns; turn += 1) [x, y] = [-y, x];
    return [x + pivot[0] + translate[0], y + pivot[1] + translate[1]];
  };
  const next = entries.map(({ cube, face }) => ({
    cube,
    face,
    a: transform([face.uv![0], face.uv![1]]),
    b: transform([face.uv![2], face.uv![3]]),
  }));
  const width = Project?.texture_width ?? 16;
  const height = Project?.texture_height ?? 16;
  if (
    opts.clamp_to_texture !== false &&
    next.some(({ a, b }) =>
      [a, b].some(([x, y]) => x < 0 || y < 0 || x > width || y > height),
    )
  ) {
    throw new CommandError(
      "E_INVALID_PARAM",
      `Transformed UV would leave ${width}×${height} texture bounds`,
    );
  }
  return getHost().undo.run(
    { elements: cubes, uv_only: true },
    "transform_uv_islands",
    () => {
      for (const { cube, face, a, b } of next) {
        cube.box_uv = false;
        face.uv = [a[0], a[1], b[0], b[1]];
        face.rotation =
          ((face.rotation ?? 0) + Number(opts.rotate ?? "0")) % 360;
      }
      refreshView(cubes);
      return {
        ok: true as const,
        undo_label: "transform_uv_islands",
        updated: cubes.map((cube) => cube.uuid),
      };
    },
  );
}
