import { findElement, requireProject } from "../bb/elements.js";
import { CommandError } from "../errors.js";
import { cubeWorldBounds, geometricCubeVolume } from "./spatial.js";

type Bounds = { min: [number, number, number]; max: [number, number, number] };

function cubeBounds(cube: Cube): Bounds {
  return cubeWorldBounds(cube);
}

function descendantCubes(group: Group): Cube[] {
  const out: Cube[] = [];
  const visit = (child: Group | Cube) => {
    if (child instanceof Cube) out.push(child);
    else
      for (const nested of child.children ?? []) visit(nested as Group | Cube);
  };
  for (const child of group.children ?? []) visit(child as Group | Cube);
  return out;
}

export function measureModel(opts: { refs?: string[] }): {
  bounds: { min: number[]; max: number[]; size: number[]; center: number[] };
  cubes: number;
  total_volume: number;
  elements: Array<Record<string, unknown>>;
} {
  requireProject();
  const refs = opts.refs?.length
    ? opts.refs.map((ref) => {
        const element = findElement(ref);
        if (!element)
          throw new CommandError("E_NOT_FOUND", `Element not found: ${ref}`);
        return element;
      })
    : [...Cube.all];
  const rows = refs.map((element) => {
    const cubes =
      element instanceof Cube ? [element] : descendantCubes(element);
    const boxes = cubes.map(cubeBounds);
    const min = [0, 1, 2].map((i) =>
      boxes.length
        ? Math.min(...boxes.map((b) => b.min[i]))
        : element.origin[i],
    );
    const max = [0, 1, 2].map((i) =>
      boxes.length
        ? Math.max(...boxes.map((b) => b.max[i]))
        : element.origin[i],
    );
    return {
      ref: element.uuid,
      name: element.name,
      type: element instanceof Cube ? "cube" : "group",
      cubes: cubes.length,
      min,
      max,
      size: min.map((v, i) => max[i] - v),
      center: min.map((v, i) => (v + max[i]) / 2),
      volume: cubes.reduce((sum, cube) => sum + geometricCubeVolume(cube), 0),
    };
  });
  const boxes = rows.filter((r) => r.cubes > 0);
  const uniqueCubes = new Map<string, Cube>();
  for (const element of refs) {
    const cubes =
      element instanceof Cube ? [element] : descendantCubes(element);
    for (const cube of cubes) uniqueCubes.set(cube.uuid, cube);
  }
  const min = [0, 1, 2].map((i) =>
    boxes.length ? Math.min(...boxes.map((r) => r.min[i])) : 0,
  );
  const max = [0, 1, 2].map((i) =>
    boxes.length ? Math.max(...boxes.map((r) => r.max[i])) : 0,
  );
  return {
    bounds: {
      min,
      max,
      size: min.map((v, i) => max[i] - v),
      center: min.map((v, i) => (v + max[i]) / 2),
    },
    cubes: uniqueCubes.size,
    total_volume: [...uniqueCubes.values()].reduce(
      (sum, cube) => sum + geometricCubeVolume(cube),
      0,
    ),
    elements: rows,
  };
}

export function auditSymmetry(opts: {
  pairs: Array<{ left: string; right: string }>;
  axis?: "x" | "y" | "z";
  pivot?: number;
  tolerance?: number;
}): {
  axis: string;
  pivot: number;
  pairs: Array<Record<string, unknown>>;
  summary: { passed: number; failed: number };
} {
  requireProject();
  const axis = opts.axis ?? "x";
  const ai = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const pivot = opts.pivot ?? 0;
  const tolerance = opts.tolerance ?? 0.001;
  const pairs = opts.pairs.map((pair) => {
    const left = findElement(pair.left);
    const right = findElement(pair.right);
    if (!left || !right)
      throw new CommandError(
        "E_NOT_FOUND",
        `Symmetry pair missing: ${pair.left}/${pair.right}`,
      );
    if (left instanceof Cube !== right instanceof Cube)
      throw new CommandError(
        "E_INVALID_PARAM",
        "Symmetry pair types must match",
      );
    const points = (element: Group | Cube) =>
      element instanceof Cube
        ? {
            min: cubeBounds(element).min,
            max: cubeBounds(element).max,
            origin: [...element.origin],
          }
        : {
            min: [...element.origin],
            max: [...element.origin],
            origin: [...element.origin],
          };
    const a = points(left);
    const b = points(right);
    const expectedMin = [...a.min];
    const expectedMax = [...a.max];
    const expectedOrigin = [...a.origin];
    expectedMin[ai] = pivot * 2 - a.max[ai];
    expectedMax[ai] = pivot * 2 - a.min[ai];
    expectedOrigin[ai] = pivot * 2 - a.origin[ai];
    const errors = [0, 1, 2].flatMap((i) => [
      Math.abs(expectedMin[i] - b.min[i]),
      Math.abs(expectedMax[i] - b.max[i]),
      Math.abs(expectedOrigin[i] - b.origin[i]),
    ]);
    const max_error = Math.max(...errors);
    return {
      left: left.name,
      right: right.name,
      max_error,
      passed: max_error <= tolerance,
      expected: { min: expectedMin, max: expectedMax, origin: expectedOrigin },
      actual: b,
    };
  });
  return {
    axis,
    pivot,
    pairs,
    summary: {
      passed: pairs.filter((p) => p.passed).length,
      failed: pairs.filter((p) => !p.passed).length,
    },
  };
}
