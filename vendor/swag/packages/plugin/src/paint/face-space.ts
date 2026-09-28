export type FaceSpace = {
  width: number;
  height: number;
  uv: [number, number, number, number];
  rotation: 0 | 90 | 180 | 270;
};

export function resolveFaceSpace(cube: Cube, faceName: string): FaceSpace {
  const face = cube.faces?.[faceName];
  const uv = [...(face?.uv ?? [0, 0, 1, 1])] as [
    number,
    number,
    number,
    number,
  ];
  const rawRotation = (face as unknown as { rotation?: number })?.rotation ?? 0;
  const rotation = (
    [0, 90, 180, 270].includes(rawRotation) ? rawRotation : 0
  ) as FaceSpace["rotation"];
  const atlasWidth = Math.max(1, Math.round(Math.abs(uv[2] - uv[0])));
  const atlasHeight = Math.max(1, Math.round(Math.abs(uv[3] - uv[1])));
  const quarterTurn = rotation === 90 || rotation === 270;
  return {
    width: quarterTurn ? atlasHeight : atlasWidth,
    height: quarterTurn ? atlasWidth : atlasHeight,
    uv,
    rotation,
  };
}

function rotate(
  u: number,
  v: number,
  rotation: FaceSpace["rotation"],
): [number, number] {
  if (rotation === 90) return [1 - v, u];
  if (rotation === 180) return [1 - u, 1 - v];
  if (rotation === 270) return [v, 1 - u];
  return [u, v];
}

export function faceLocalToAtlas(
  space: FaceSpace,
  x: number,
  y: number,
): [number, number] {
  const [u, v] = rotate(
    (x + 0.5) / space.width,
    (y + 0.5) / space.height,
    space.rotation,
  );
  return [
    Math.floor(space.uv[0] + (space.uv[2] - space.uv[0]) * u),
    Math.floor(space.uv[1] + (space.uv[3] - space.uv[1]) * v),
  ];
}

function atlasPoint(space: FaceSpace, x: number, y: number): [number, number] {
  const [u, v] = rotate(x / space.width, y / space.height, space.rotation);
  return [
    space.uv[0] + (space.uv[2] - space.uv[0]) * u,
    space.uv[1] + (space.uv[3] - space.uv[1]) * v,
  ];
}

/** Rasterize face-local pixels into the atlas while honoring face rotation and UV flips. */
export function paintFaceLocal(
  atlas: CanvasRenderingContext2D,
  space: FaceSpace,
  paint: (ctx: CanvasRenderingContext2D) => void,
): void {
  const local = document.createElement("canvas");
  local.width = space.width;
  local.height = space.height;
  const localCtx = local.getContext("2d");
  if (!localCtx) return;
  localCtx.imageSmoothingEnabled = false;
  paint(localCtx);
  const pixels = localCtx.getImageData(0, 0, local.width, local.height).data;
  for (let y = 0; y < local.height; y += 1) {
    for (let x = 0; x < local.width; x += 1) {
      const index = (y * local.width + x) * 4;
      if (pixels[index + 3] === 0) continue;
      const corners = [
        atlasPoint(space, x, y),
        atlasPoint(space, x + 1, y),
        atlasPoint(space, x, y + 1),
        atlasPoint(space, x + 1, y + 1),
      ];
      const minX = Math.floor(Math.min(...corners.map((point) => point[0])));
      const minY = Math.floor(Math.min(...corners.map((point) => point[1])));
      const maxX = Math.ceil(Math.max(...corners.map((point) => point[0])));
      const maxY = Math.ceil(Math.max(...corners.map((point) => point[1])));
      atlas.fillStyle = `rgba(${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3] / 255})`;
      atlas.fillRect(
        minX,
        minY,
        Math.max(1, maxX - minX),
        Math.max(1, maxY - minY),
      );
    }
  }
}
