import type { CheckModelResult } from "@blockbench-mcp/shared";
import { requireProject } from "../bb/elements.js";
import { center, dist, overlaps, volume } from "./aabb.js";
import { getUvLayout } from "../paint/uv-layout.js";
import { cubeWorldBounds, geometricCubeVolume } from "../geometry/spatial.js";

export function runCheckModel(
  opts: {
    allowed_uv_overlaps?: Array<{
      a: {
        cube: string;
        face: "north" | "south" | "east" | "west" | "up" | "down";
      };
      b: {
        cube: string;
        face: "north" | "south" | "east" | "west" | "up" | "down";
      };
    }>;
  } = {},
): CheckModelResult {
  requireProject();
  const findings: CheckModelResult["findings"] = [];

  for (const g of Group.all) {
    const childCount = g.children?.length ?? 0;
    if (childCount === 0) {
      findings.push({
        severity: "error",
        code: "EMPTY_GROUP",
        element: g.name,
        message: `Group "${g.name}" has no children — delete it or add geometry.`,
      });
    }
  }

  const aabbs = Cube.all.map((c) => ({ cube: c, box: cubeWorldBounds(c) }));
  for (const { cube, box } of aabbs) {
    if (geometricCubeVolume(cube) <= 0) {
      findings.push({
        severity: "error",
        code: "ZERO_VOLUME",
        element: cube.name,
        message: `Cube "${cube.name}" has zero volume.`,
      });
    }
    const sizes = [
      box.max[0] - box.min[0],
      box.max[1] - box.min[1],
      box.max[2] - box.min[2],
    ];
    if (sizes.some((s) => s > 0 && s < 1)) {
      findings.push({
        severity: "warn",
        code: "SLIVER",
        element: cube.name,
        message: `Cube "${cube.name}" has a sub-1 unit thickness — often looks noisy.`,
      });
    }
    const untextured = Object.entries(cube.faces ?? {}).filter(
      ([, f]) => f && (f.texture === null || f.texture === undefined),
    );
    if (untextured.length > 0) {
      findings.push({
        severity: "warn",
        code: "UNTEXTURED_FACE",
        element: cube.name,
        message: `Cube "${cube.name}" has ${untextured.length} untextured face(s).`,
      });
    }
    const textureWidth = Project?.texture_width ?? 16;
    const textureHeight = Project?.texture_height ?? 16;
    const uvOutside = Object.entries(cube.faces ?? {}).filter(([, face]) => {
      const uv = face?.uv;
      return (
        Array.isArray(uv) &&
        uv.length >= 4 &&
        (Math.min(uv[0], uv[2]) < 0 ||
          Math.min(uv[1], uv[3]) < 0 ||
          Math.max(uv[0], uv[2]) > textureWidth ||
          Math.max(uv[1], uv[3]) > textureHeight)
      );
    });
    if (uvOutside.length > 0) {
      findings.push({
        severity: "error",
        code: "UV_OUT_OF_BOUNDS",
        element: cube.name,
        message: `Cube "${cube.name}" has ${uvOutside.length} face UV(s) outside ${textureWidth}×${textureHeight}.`,
      });
    }
    // Pivot far from geometry (group origin vs cube center)
    const parent = cube.parent;
    if (parent && parent !== "root" && typeof parent !== "string") {
      const d = dist(center(box), parent.origin as [number, number, number]);
      const diag = dist(box.min, box.max);
      if (diag > 0 && d > diag * 2.5) {
        findings.push({
          severity: "warn",
          code: "BAD_PIVOT",
          element: cube.name,
          message: `Cube "${cube.name}" is far from parent pivot — animation may look wrong.`,
        });
      }
    }
  }

  for (let i = 0; i < aabbs.length; i++) {
    for (let j = i + 1; j < aabbs.length; j++) {
      const a = aabbs[i];
      const b = aabbs[j];
      if (!overlaps(a.box, b.box)) continue;
      const inter =
        Math.max(
          0,
          Math.min(a.box.max[0], b.box.max[0]) -
            Math.max(a.box.min[0], b.box.min[0]),
        ) *
        Math.max(
          0,
          Math.min(a.box.max[1], b.box.max[1]) -
            Math.max(a.box.min[1], b.box.min[1]),
        ) *
        Math.max(
          0,
          Math.min(a.box.max[2], b.box.max[2]) -
            Math.max(a.box.min[2], b.box.min[2]),
        );
      const smaller = Math.min(volume(a.box), volume(b.box));
      if (smaller > 0 && inter / smaller > 0.35) {
        findings.push({
          severity: "info",
          code: "OVERLAP",
          element: `${a.cube.name}|${b.cube.name}`,
          message: `Cubes "${a.cube.name}" and "${b.cube.name}" overlap significantly.`,
        });
      }
    }
  }

  const uvLayout = getUvLayout({
    include_overlaps: true,
    allowed_overlaps: opts.allowed_uv_overlaps?.map(({ a, b }) => ({
      cube_a: a.cube,
      a: a.face,
      cube_b: b.cube,
      b: b.face,
    })),
  });
  if (uvLayout.summary.unintended_overlaps > 0) {
    const unintended = uvLayout.overlaps.filter((pair) => !pair.intentional);
    const examples = unintended
      .slice(0, 3)
      .map((pair) => `${pair.a}↔${pair.b}`)
      .join(", ");
    findings.push({
      severity: "warn",
      code: "UV_OVERLAP",
      message: `${unintended.length} unintended overlapping UV face pair(s) detected${examples ? `: ${examples}` : ""}. Review get_uv_layout before painting.`,
    });
  }

  if (Cube.all.length === 0) {
    findings.push({
      severity: "error",
      code: "NO_CUBES",
      message: "Project has no cubes.",
    });
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  return {
    findings,
    summary: {
      cubes: Cube.all.length,
      groups: Group.all.length,
      errors,
      warns,
    },
  };
}
