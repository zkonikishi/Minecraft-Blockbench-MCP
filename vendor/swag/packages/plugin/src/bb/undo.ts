import { getHost } from "../host/live.js";
import type { UndoTrack } from "../host/ports.js";

/** @deprecated prefer getHost().undo — kept as thin alias during migration */
export function withUndo<T>(
  aspects: Record<string, unknown>,
  label: string,
  fn: ((track: UndoTrack) => T) | (() => T),
): T {
  return getHost().undo.run(aspects, label, (track) => {
    if (fn.length >= 1) return (fn as (t: UndoTrack) => T)(track);
    return (fn as () => T)();
  });
}
