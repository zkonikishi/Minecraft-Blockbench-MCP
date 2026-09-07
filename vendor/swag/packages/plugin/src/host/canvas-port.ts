import type { BbElementRef, CanvasPort } from "./ports.js";

export function createCanvasPort(): CanvasPort {
  return {
    updateElements(elements, aspects = { geometry: true, uv: true, faces: true }) {
      const host = globalThis as unknown as {
        Canvas?: { updateView?: (opts: Record<string, unknown>) => void; updateAll?: () => void };
        Cube?: { all: Array<{ uuid: string }> };
        Group?: { all: Array<{ uuid: string; children?: Array<{ uuid: string }> }> };
      };
      const requested = new Set(elements.map((element) => element.uuid));
      const includeChildren = (element: { uuid: string; children?: Array<{ uuid: string }> }) => {
        requested.add(element.uuid);
        for (const child of element.children ?? []) includeChildren(child);
      };
      for (const group of host.Group?.all ?? []) {
        if (requested.has(group.uuid)) includeChildren(group);
      }
      const cubes = host.Cube?.all.filter((cube) => requested.has(cube.uuid)) ?? [];
      const groups = host.Group?.all.filter((group) => requested.has(group.uuid)) ?? [];
      if (host.Canvas?.updateView && (cubes.length || groups.length)) {
        host.Canvas.updateView({
          elements: cubes,
          groups,
          element_aspects: { ...aspects, transform: true, visibility: true },
          group_aspects: { transform: true, visibility: true },
          selection: false,
        });
      } else host.Canvas?.updateAll?.();
    },
    updateAll() {
      (globalThis as unknown as { Canvas?: { updateAll?: () => void } }).Canvas?.updateAll?.();
    },
  };
}

export function refsOf(
  ...els: Array<{ uuid: string; name: string } | undefined | null>
): BbElementRef[] {
  return els.filter(Boolean).map((element) => ({ uuid: element!.uuid, name: element!.name }));
}
