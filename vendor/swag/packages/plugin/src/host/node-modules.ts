import { CommandError } from "../errors.js";

export function requireNodeModule<T>(name: string): T {
  const scoped = typeof require === "function" ? require : undefined;
  const load = scoped ?? (globalThis as unknown as {
    require?: (id: string) => unknown;
  }).require;
  if (!load) {
    throw new CommandError("E_BLOCKBENCH_ERROR", "Node modules unavailable; use Blockbench desktop");
  }
  try {
    const value = load(name);
    if (!value) throw new Error("Module permission denied");
    return value as T;
  } catch {
    throw new CommandError("E_BLOCKBENCH_ERROR",
      "Node module " + name + " unavailable; allow this plugin's desktop module permission and retry");
  }
}
