import type { Vec3 } from "@blockbench-mcp/shared";

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export function cubeAabb(cube: Cube): Aabb {
  const min: Vec3 = [
    Math.min(cube.from[0], cube.to[0]),
    Math.min(cube.from[1], cube.to[1]),
    Math.min(cube.from[2], cube.to[2]),
  ];
  const max: Vec3 = [
    Math.max(cube.from[0], cube.to[0]),
    Math.max(cube.from[1], cube.to[1]),
    Math.max(cube.from[2], cube.to[2]),
  ];
  return { min, max };
}

export function volume(a: Aabb): number {
  return (
    Math.max(0, a.max[0] - a.min[0]) *
    Math.max(0, a.max[1] - a.min[1]) *
    Math.max(0, a.max[2] - a.min[2])
  );
}

export function overlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.min[0] < b.max[0] &&
    a.max[0] > b.min[0] &&
    a.min[1] < b.max[1] &&
    a.max[1] > b.min[1] &&
    a.min[2] < b.max[2] &&
    a.max[2] > b.min[2]
  );
}

export function center(a: Aabb): Vec3 {
  return [
    (a.min[0] + a.max[0]) / 2,
    (a.min[1] + a.max[1]) / 2,
    (a.min[2] + a.max[2]) / 2,
  ];
}

export function dist(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
