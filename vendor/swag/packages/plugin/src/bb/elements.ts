import { CommandError } from "../errors.js";
import { getHost } from "../host/live.js";

export function requireProject(): void {
  if (!(globalThis as unknown as { Project?: unknown }).Project) {
    throw new CommandError("E_BLOCKBENCH_ERROR", "No project is open in Blockbench.");
  }
}

export function currentFormatId(): string | null {
  return getHost().formats.currentId();
}

export function findGroup(ref: string): Group | undefined {
  return Group.all.find((g) => g.uuid === ref || g.name === ref);
}

export function findCube(ref: string): Cube | undefined {
  return Cube.all.find((c) => c.uuid === ref || c.name === ref);
}

export function findElement(ref: string): Group | Cube | undefined {
  return findGroup(ref) ?? findCube(ref);
}

export function requireGroup(ref: string): Group {
  const g = findGroup(ref);
  if (!g) throw new CommandError("E_NOT_FOUND", `Group not found: ${ref}`);
  return g;
}

export function requireCube(ref: string): Cube {
  const c = findCube(ref);
  if (!c) throw new CommandError("E_NOT_FOUND", `Cube not found: ${ref}`);
  return c;
}

export function parentOf(ref: string | undefined): Group | "root" {
  if (!ref || ref === "root") return "root";
  return requireGroup(ref);
}

export function refreshView(elements?: Array<{ uuid: string; name: string }>): void {
  const host = getHost();
  if (elements?.length) host.canvas.updateElements(elements);
  else host.canvas.updateAll();
}
