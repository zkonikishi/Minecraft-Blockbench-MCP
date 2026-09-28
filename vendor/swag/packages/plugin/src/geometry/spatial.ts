type Vec3 = [number, number, number];

export type Bounds3 = { min: Vec3; max: Vec3 };

function rotate(point: Vec3, pivot: Vec3, rotation: number[]): Vec3 {
  let [x, y, z] = [
    point[0] - pivot[0],
    point[1] - pivot[1],
    point[2] - pivot[2],
  ];
  for (let axis = 0; axis < 3; axis += 1) {
    const radians = ((rotation[axis] ?? 0) * Math.PI) / 180;
    if (radians === 0) continue;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    if (axis === 0) [y, z] = [y * c - z * s, y * s + z * c];
    else if (axis === 1) [x, z] = [x * c + z * s, -x * s + z * c];
    else [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x + pivot[0], y + pivot[1], z + pivot[2]];
}

function parentGroups(cube: Cube): Group[] {
  const groups: Group[] = [];
  let parent = cube.parent;
  while (parent && parent !== "root" && typeof parent !== "string") {
    groups.push(parent);
    parent = parent.parent;
  }
  return groups;
}

export function cubeWorldCorners(cube: Cube): Vec3[] {
  const lo = cube.from.map(
    (value, i) => Math.min(value, cube.to[i]) - (cube.inflate ?? 0),
  ) as Vec3;
  const hi = cube.from.map(
    (value, i) => Math.max(value, cube.to[i]) + (cube.inflate ?? 0),
  ) as Vec3;
  const points: Vec3[] = [];
  for (const x of [lo[0], hi[0]])
    for (const y of [lo[1], hi[1]])
      for (const z of [lo[2], hi[2]]) points.push([x, y, z]);
  return points.map((point) => {
    let next = rotate(point, cube.origin as Vec3, cube.rotation);
    for (const group of parentGroups(cube)) {
      next = rotate(next, group.origin as Vec3, group.rotation);
    }
    return next;
  });
}

export function boundsOfPoints(points: Vec3[]): Bounds3 {
  if (!points.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  return {
    min: [0, 1, 2].map((i) =>
      Math.min(...points.map((point) => point[i])),
    ) as Vec3,
    max: [0, 1, 2].map((i) =>
      Math.max(...points.map((point) => point[i])),
    ) as Vec3,
  };
}

export function cubeWorldBounds(cube: Cube): Bounds3 {
  return boundsOfPoints(cubeWorldCorners(cube));
}

export function geometricCubeVolume(cube: Cube): number {
  return [0, 1, 2].reduce(
    (volume, i) =>
      volume *
      Math.max(
        0,
        Math.abs(cube.to[i] - cube.from[i]) + (cube.inflate ?? 0) * 2,
      ),
    1,
  );
}
